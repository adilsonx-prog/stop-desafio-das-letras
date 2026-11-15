-- New room stages: review (collective check) and final (podium).
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('lobby','playing','stopped','review','results','final'));
-- Rounds after this number belong to the current game (reset_room moves it forward).
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS game_start_round integer NOT NULL DEFAULT 0;

-- Categories annulled by the group for this answer.
ALTER TABLE public.round_answers ADD COLUMN IF NOT EXISTS rejected text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.answer_disputes (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  target_player_id uuid NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  category text NOT NULL,
  voter_player_id uuid NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, round_number, target_player_id, category, voter_player_id)
);
GRANT SELECT ON public.answer_disputes TO anon, authenticated;
GRANT ALL ON public.answer_disputes TO service_role;
ALTER TABLE public.answer_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Disputes are readable" ON public.answer_disputes FOR SELECT TO anon, authenticated USING (true);

-- Current round answers become readable once scoring starts (review), as before for results/lobby.
DROP POLICY IF EXISTS "Finished round answers are readable" ON public.round_answers;
CREATE POLICY "Finished round answers are readable" ON public.round_answers FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.rooms r
  WHERE r.id = round_answers.room_id
    AND (round_answers.round_number < r.round_number OR r.status IN ('review','results','lobby','final'))
));

-- Late edits: after STOP only a 3s grace window lets in-flight answers land, then everything is locked.
CREATE OR REPLACE FUNCTION public.save_answers(p_player_id uuid, p_secret text, p_round integer, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR SHARE;
  IF v_room.round_number <> p_round THEN RETURN; END IF;
  IF NOT (v_room.status = 'playing'
          OR (v_room.status = 'stopped' AND v_room.stopped_at > now() - interval '3 seconds')) THEN
    RETURN;
  END IF;
  INSERT INTO public.round_answers(room_id, round_number, player_id, answers)
  VALUES (v_room.id, p_round, v_player.id, public.stop_clean_answers(p_answers))
  ON CONFLICT (room_id, round_number, player_id)
  DO UPDATE SET answers = EXCLUDED.answers, updated_at = now();
END $$;

-- Votes needed to annul an answer: a majority of the other players.
CREATE OR REPLACE FUNCTION public.stop_votes_needed(p_players integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT greatest(1, (greatest(p_players, 1) - 1) / 2 + 1)
$$;

-- Scores the current round of a room from answers + group contests. Repeats only count within a category.
CREATE OR REPLACE FUNCTION public.stop_score_round(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_room public.rooms; v_ans public.round_answers;
  k text; n text; c int; pts int; v_points jsonb; v_total int; v_letter text; v_need int;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  v_letter := lower(v_room.current_letter);
  SELECT public.stop_votes_needed(count(*)::int) INTO v_need FROM public.room_players WHERE room_id = p_room_id;

  UPDATE public.round_answers a SET rejected = coalesce((
    SELECT array_agg(d.category) FROM (
      SELECT x.category FROM public.answer_disputes x
      WHERE x.room_id = a.room_id AND x.round_number = a.round_number AND x.target_player_id = a.player_id
      GROUP BY x.category HAVING count(*) >= v_need
    ) d
  ), '{}')
  WHERE a.room_id = p_room_id AND a.round_number = v_room.round_number;

  FOR v_ans IN SELECT * FROM public.round_answers WHERE room_id = p_room_id AND round_number = v_room.round_number LOOP
    v_points := '{}'::jsonb; v_total := 0;
    FOREACH k IN ARRAY public.stop_categories() LOOP
      n := public.stop_normalize(v_ans.answers->>k);
      IF length(n) >= 2 AND left(n, 1) = v_letter AND NOT (k = ANY(v_ans.rejected)) THEN
        SELECT count(*) INTO c FROM public.round_answers o
        WHERE o.room_id = p_room_id AND o.round_number = v_room.round_number
          AND public.stop_normalize(o.answers->>k) = n AND NOT (k = ANY(o.rejected));
        pts := CASE WHEN c > 1 THEN 5 ELSE 10 END;
      ELSE
        pts := 0;
      END IF;
      v_points := v_points || jsonb_build_object(k, pts);
      v_total := v_total + pts;
    END LOOP;
    UPDATE public.round_answers SET points = v_points, total = v_total WHERE id = v_ans.id;
  END LOOP;

  -- Provisional round points shown during review.
  UPDATE public.room_players p SET last_round_points = coalesce((
    SELECT a.total FROM public.round_answers a
    WHERE a.room_id = p_room_id AND a.round_number = v_room.round_number AND a.player_id = p.id
  ), 0)
  WHERE p.room_id = p_room_id;
END $$;

-- STOP -> review: answers are scored but do not count until the host confirms.
CREATE OR REPLACE FUNCTION public.finish_round(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.status <> 'stopped' THEN RETURN; END IF;
  -- Host scores the round; anyone may do it if the host is gone for 8s.
  IF v_room.host_player_id <> v_player.id AND v_room.stopped_at > now() - interval '8 seconds' THEN RETURN; END IF;
  -- Never score before the late-answer window closes.
  IF v_room.stopped_at > now() - interval '3 seconds' THEN RETURN; END IF;
  PERFORM public.stop_score_round(v_room.id);
  UPDATE public.rooms SET status = 'review', updated_at = now() WHERE id = v_room.id;
END $$;

-- Contest (or un-contest) another player's answer during review.
CREATE OR REPLACE FUNCTION public.toggle_dispute(p_player_id uuid, p_secret text, p_target uuid, p_category text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.status <> 'review' THEN RAISE EXCEPTION 'A conferência desta rodada já foi encerrada.'; END IF;
  IF p_target = v_player.id THEN RAISE EXCEPTION 'Você não pode contestar a sua própria resposta.'; END IF;
  IF NOT (p_category = ANY(public.stop_categories())) THEN RAISE EXCEPTION 'Categoria inválida.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE id = p_target AND room_id = v_room.id) THEN
    RAISE EXCEPTION 'Jogador não está na sala.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.answer_disputes WHERE room_id = v_room.id AND round_number = v_room.round_number
             AND target_player_id = p_target AND category = p_category AND voter_player_id = v_player.id) THEN
    DELETE FROM public.answer_disputes WHERE room_id = v_room.id AND round_number = v_room.round_number
      AND target_player_id = p_target AND category = p_category AND voter_player_id = v_player.id;
  ELSE
    INSERT INTO public.answer_disputes(room_id, round_number, target_player_id, category, voter_player_id)
    VALUES (v_room.id, v_room.round_number, p_target, p_category, v_player.id);
  END IF;
  PERFORM public.stop_score_round(v_room.id);
  UPDATE public.rooms SET updated_at = now() WHERE id = v_room.id;
END $$;

-- Host closes the review: round points are added to the scoreboard.
CREATE OR REPLACE FUNCTION public.confirm_round(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.status <> 'review' THEN RETURN; END IF;
  IF v_room.host_player_id <> v_player.id THEN RAISE EXCEPTION 'Só o anfitrião pode confirmar o resultado.'; END IF;
  PERFORM public.stop_score_round(v_room.id);
  UPDATE public.room_players p SET score = p.score + p.last_round_points WHERE p.room_id = v_room.id;
  UPDATE public.rooms SET status = 'results', updated_at = now() WHERE id = v_room.id;
END $$;

-- Host ends the game: podium screen.
CREATE OR REPLACE FUNCTION public.end_game(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.host_player_id <> v_player.id THEN RAISE EXCEPTION 'Só o anfitrião pode encerrar a partida.'; END IF;
  IF v_room.status NOT IN ('results','lobby') THEN RAISE EXCEPTION 'Termine a rodada antes de encerrar a partida.'; END IF;
  UPDATE public.rooms SET status = 'final', updated_at = now() WHERE id = v_room.id;
END $$;

-- Play again: same players, scores zeroed, new game history starts after the current round.
CREATE OR REPLACE FUNCTION public.reset_room(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.host_player_id <> v_player.id THEN RAISE EXCEPTION 'Só o anfitrião pode reiniciar a partida.'; END IF;
  UPDATE public.room_players SET score = 0, last_round_points = 0 WHERE room_id = v_room.id;
  UPDATE public.rooms SET status = 'lobby', current_letter = NULL, used_letters = '{}',
    stopped_by = NULL, stopped_at = NULL, game_start_round = round_number, updated_at = now()
  WHERE id = v_room.id;
END $$;

REVOKE ALL ON FUNCTION public.stop_score_round(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.toggle_dispute(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_round(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_game(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_dispute(uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_round(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_game(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_answers(uuid, text, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_round(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_room(uuid, text) TO anon, authenticated;