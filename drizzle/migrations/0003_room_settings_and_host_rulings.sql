-- Per-room rules chosen by the host in the lobby.
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '[{"key":"nome","label":"Nome"},{"key":"cidade","label":"Cidade"},{"key":"estado","label":"Estado ou País"},{"key":"cep","label":"CEP"},{"key":"cor","label":"Cor"},{"key":"comida","label":"Comida"},{"key":"fruta","label":"Fruta"},{"key":"filme","label":"Filme, Desenho ou Série"},{"key":"sogra","label":"Minha sogra é…"},{"key":"animal","label":"Animal"},{"key":"objeto","label":"Objeto"},{"key":"profissao","label":"Profissão"},{"key":"marca","label":"Marca"}]'::jsonb;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS letters text[] NOT NULL DEFAULT '{A,B,C,D,E,F,G,H,I,J,L,M,N,O,P,R,S,T,U,V}';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS round_seconds integer;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS max_rounds integer;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_round_seconds_check CHECK (round_seconds IS NULL OR round_seconds IN (60, 90, 120));
ALTER TABLE public.rooms ADD CONSTRAINT rooms_max_rounds_check CHECK (max_rounds IS NULL OR max_rounds IN (3, 5, 10));

-- Contested answers the host decided to keep (annulled ones stay in "rejected").
ALTER TABLE public.round_answers ADD COLUMN IF NOT EXISTS kept text[] NOT NULL DEFAULT '{}';

COMMENT ON FUNCTION public.stop_votes_needed(integer) IS 'DEPRECATED: contests no longer annul by majority; the host rules each contested answer (rule_answer)';

-- Category keys of a room, in play order (falls back to the default list).
CREATE OR REPLACE FUNCTION public.stop_room_categories(p_room_id uuid)
RETURNS text[] LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(
    (SELECT array_agg(t.e->>'key' ORDER BY t.ord)
       FROM public.rooms r, jsonb_array_elements(r.categories) WITH ORDINALITY AS t(e, ord)
      WHERE r.id = p_room_id),
    public.stop_categories())
$$;

CREATE OR REPLACE FUNCTION public.stop_clean_answers(p_answers jsonb, p_keys text[])
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_object_agg(k, left(trim(coalesce(p_answers->>k, '')), 40)), '{}'::jsonb)
  FROM unnest(p_keys) AS k
$$;

-- Host saves the room rules (lobby only).
CREATE OR REPLACE FUNCTION public.update_room_settings(
  p_player_id uuid, p_secret text, p_categories jsonb, p_letters text[], p_round_seconds integer, p_max_rounds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player public.room_players; v_room public.rooms;
  e jsonb; v_key text; v_label text; v_keys text[] := '{}'; v_norms text[] := '{}';
  v_cats jsonb := '[]'::jsonb; v_letters text[];
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.host_player_id <> v_player.id THEN RAISE EXCEPTION 'Só o anfitrião pode mudar as regras da sala.'; END IF;
  IF v_room.status <> 'lobby' THEN RAISE EXCEPTION 'As regras só podem ser mudadas na sala de espera.'; END IF;
  IF p_categories IS NULL OR jsonb_typeof(p_categories) <> 'array' THEN RAISE EXCEPTION 'Categorias inválidas.'; END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p_categories) AS x LOOP
    v_key := e->>'key';
    v_label := left(regexp_replace(trim(coalesce(e->>'label', '')), '\s+', ' ', 'g'), 30);
    IF v_key IS NULL OR v_key !~ '^[a-z0-9_]{1,24}$' THEN RAISE EXCEPTION 'Categoria inválida.'; END IF;
    IF length(v_label) < 2 THEN RAISE EXCEPTION 'Cada categoria precisa de um nome com pelo menos 2 letras.'; END IF;
    IF v_key = ANY(v_keys) OR public.stop_normalize(v_label) = ANY(v_norms) THEN
      RAISE EXCEPTION 'Categoria repetida: %', v_label;
    END IF;
    v_keys := v_keys || v_key;
    v_norms := v_norms || public.stop_normalize(v_label);
    v_cats := v_cats || jsonb_build_array(jsonb_build_object('key', v_key, 'label', v_label));
  END LOOP;
  IF coalesce(array_length(v_keys, 1), 0) < 4 OR array_length(v_keys, 1) > 15 THEN
    RAISE EXCEPTION 'Escolha de 4 a 15 categorias.';
  END IF;
  SELECT array_agg(DISTINCT upper(l) ORDER BY upper(l)) INTO v_letters
    FROM unnest(coalesce(p_letters, '{}')) AS l WHERE upper(l) ~ '^[A-Z]$';
  IF coalesce(array_length(v_letters, 1), 0) < 5 THEN RAISE EXCEPTION 'Deixe pelo menos 5 letras no sorteio.'; END IF;
  IF p_round_seconds IS NOT NULL AND p_round_seconds NOT IN (60, 90, 120) THEN RAISE EXCEPTION 'Tempo de rodada inválido.'; END IF;
  IF p_max_rounds IS NOT NULL AND p_max_rounds NOT IN (3, 5, 10) THEN RAISE EXCEPTION 'Número de rodadas inválido.'; END IF;
  UPDATE public.rooms SET categories = v_cats, letters = v_letters, round_seconds = p_round_seconds,
    max_rounds = p_max_rounds, updated_at = now()
  WHERE id = v_room.id;
END $$;

-- Draw from the room's letters; respect the round limit.
CREATE OR REPLACE FUNCTION public.start_round(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player public.room_players; v_room public.rooms;
  v_letters text[]; v_available text[]; v_letter text; v_used text[];
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.host_player_id <> v_player.id THEN RAISE EXCEPTION 'Só o anfitrião pode iniciar a rodada.'; END IF;
  IF v_room.status NOT IN ('lobby','results') THEN RAISE EXCEPTION 'A rodada já está em andamento.'; END IF;
  IF v_room.max_rounds IS NOT NULL AND v_room.round_number - v_room.game_start_round >= v_room.max_rounds THEN
    RAISE EXCEPTION 'Todas as rodadas desta partida já foram jogadas.';
  END IF;
  v_letters := v_room.letters;
  IF coalesce(array_length(v_letters, 1), 0) = 0 THEN
    v_letters := string_to_array('A,B,C,D,E,F,G,H,I,J,L,M,N,O,P,R,S,T,U,V', ',');
  END IF;
  v_used := v_room.used_letters;
  SELECT array_agg(l) INTO v_available FROM unnest(v_letters) l WHERE NOT (l = ANY(v_used));
  IF v_available IS NULL OR array_length(v_available, 1) IS NULL THEN
    v_available := v_letters; v_used := '{}';
  END IF;
  v_letter := v_available[1 + floor(random() * array_length(v_available, 1))::int];
  UPDATE public.rooms SET
    status = 'playing', current_letter = v_letter, round_number = round_number + 1,
    used_letters = array_append(v_used, v_letter), round_started_at = now(),
    stopped_by = NULL, stopped_at = NULL, updated_at = now()
  WHERE id = v_room.id;
END $$;

-- Saves: while playing (until 3s after the time limit) or within 3s after STOP.
CREATE OR REPLACE FUNCTION public.save_answers(p_player_id uuid, p_secret text, p_round integer, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR SHARE;
  IF v_room.round_number <> p_round THEN RETURN; END IF;
  IF NOT (
    (v_room.status = 'playing' AND (v_room.round_seconds IS NULL
       OR v_room.round_started_at + make_interval(secs => v_room.round_seconds + 3) > now()))
    OR (v_room.status = 'stopped' AND v_room.stopped_at > now() - interval '3 seconds')) THEN
    RETURN;
  END IF;
  INSERT INTO public.round_answers(room_id, round_number, player_id, answers)
  VALUES (v_room.id, p_round, v_player.id, public.stop_clean_answers(p_answers, public.stop_room_categories(v_room.id)))
  ON CONFLICT (room_id, round_number, player_id)
  DO UPDATE SET answers = EXCLUDED.answers, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.call_stop(p_player_id uuid, p_secret text, p_round integer, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms; v_clean jsonb; k text; v_keys text[];
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.status <> 'playing' OR v_room.round_number <> p_round THEN
    RAISE EXCEPTION 'Alguém já pediu STOP!';
  END IF;
  v_keys := public.stop_room_categories(v_room.id);
  v_clean := public.stop_clean_answers(p_answers, v_keys);
  FOREACH k IN ARRAY v_keys LOOP
    IF length(v_clean->>k) = 0 THEN RAISE EXCEPTION 'Preencha todas as categorias para pedir STOP.'; END IF;
  END LOOP;
  INSERT INTO public.round_answers(room_id, round_number, player_id, answers)
  VALUES (v_room.id, p_round, v_player.id, v_clean)
  ON CONFLICT (room_id, round_number, player_id)
  DO UPDATE SET answers = EXCLUDED.answers, updated_at = now();
  UPDATE public.rooms SET status = 'stopped', stopped_by = v_player.id, stopped_at = now(), updated_at = now()
  WHERE id = v_room.id;
END $$;

-- Time limit reached: any player's device closes the round (server checks the clock).
CREATE OR REPLACE FUNCTION public.time_up_round(p_player_id uuid, p_secret text, p_round integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.status <> 'playing' OR v_room.round_number <> p_round OR v_room.round_seconds IS NULL THEN RETURN; END IF;
  IF v_room.round_started_at + make_interval(secs => v_room.round_seconds) > now() THEN RETURN; END IF;
  UPDATE public.rooms SET status = 'stopped', stopped_by = NULL, stopped_at = now(), updated_at = now()
  WHERE id = v_room.id;
END $$;

-- Scoring with the room's categories; annulments come only from the host's rulings.
CREATE OR REPLACE FUNCTION public.stop_score_round(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_room public.rooms; v_ans public.round_answers; v_keys text[];
  k text; n text; c int; pts int; v_points jsonb; v_total int; v_letter text;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  v_letter := lower(v_room.current_letter);
  v_keys := public.stop_room_categories(p_room_id);
  FOR v_ans IN SELECT * FROM public.round_answers WHERE room_id = p_room_id AND round_number = v_room.round_number LOOP
    v_points := '{}'::jsonb; v_total := 0;
    FOREACH k IN ARRAY v_keys LOOP
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
  UPDATE public.room_players p SET last_round_points = coalesce((
    SELECT a.total FROM public.round_answers a
    WHERE a.room_id = p_room_id AND a.round_number = v_room.round_number AND a.player_id = p.id
  ), 0)
  WHERE p.room_id = p_room_id;
END $$;

-- Flag (or un-flag) another player's answer. A flag alone never annuls.
CREATE OR REPLACE FUNCTION public.toggle_dispute(p_player_id uuid, p_secret text, p_target uuid, p_category text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.status <> 'review' THEN RAISE EXCEPTION 'A conferência desta rodada já foi encerrada.'; END IF;
  IF p_target = v_player.id THEN RAISE EXCEPTION 'Você não pode contestar a sua própria resposta.'; END IF;
  IF NOT (p_category = ANY(public.stop_room_categories(v_room.id))) THEN RAISE EXCEPTION 'Categoria inválida.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE id = p_target AND room_id = v_room.id) THEN
    RAISE EXCEPTION 'Jogador não está na sala.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.answer_disputes WHERE room_id = v_room.id AND round_number = v_room.round_number
             AND target_player_id = p_target AND category = p_category AND voter_player_id = v_player.id) THEN
    DELETE FROM public.answer_disputes WHERE room_id = v_room.id AND round_number = v_room.round_number
      AND target_player_id = p_target AND category = p_category AND voter_player_id = v_player.id;
    -- No flags left: drop the host's ruling, the answer goes back to normal.
    IF NOT EXISTS (SELECT 1 FROM public.answer_disputes WHERE room_id = v_room.id AND round_number = v_room.round_number
                   AND target_player_id = p_target AND category = p_category) THEN
      UPDATE public.round_answers SET rejected = array_remove(rejected, p_category), kept = array_remove(kept, p_category)
      WHERE room_id = v_room.id AND round_number = v_room.round_number AND player_id = p_target;
    END IF;
  ELSE
    INSERT INTO public.answer_disputes(room_id, round_number, target_player_id, category, voter_player_id)
    VALUES (v_room.id, v_room.round_number, p_target, p_category, v_player.id);
  END IF;
  PERFORM public.stop_score_round(v_room.id);
  UPDATE public.rooms SET updated_at = now() WHERE id = v_room.id;
END $$;

-- Host rules a contested answer: 'annul' (0 pts) or 'keep' (valid).
CREATE OR REPLACE FUNCTION public.rule_answer(p_player_id uuid, p_secret text, p_target uuid, p_category text, p_verdict text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.host_player_id <> v_player.id THEN RAISE EXCEPTION 'Só o anfitrião decide as respostas contestadas.'; END IF;
  IF v_room.status <> 'review' THEN RAISE EXCEPTION 'A conferência desta rodada já foi encerrada.'; END IF;
  IF p_verdict NOT IN ('annul', 'keep') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.answer_disputes WHERE room_id = v_room.id AND round_number = v_room.round_number
                 AND target_player_id = p_target AND category = p_category) THEN
    RAISE EXCEPTION 'Essa resposta não foi contestada.';
  END IF;
  UPDATE public.round_answers SET
    rejected = CASE WHEN p_verdict = 'annul' THEN array_append(array_remove(rejected, p_category), p_category)
                    ELSE array_remove(rejected, p_category) END,
    kept = CASE WHEN p_verdict = 'keep' THEN array_append(array_remove(kept, p_category), p_category)
                ELSE array_remove(kept, p_category) END
  WHERE room_id = v_room.id AND round_number = v_room.round_number AND player_id = p_target;
  PERFORM public.stop_score_round(v_room.id);
  UPDATE public.rooms SET updated_at = now() WHERE id = v_room.id;
END $$;

REVOKE ALL ON FUNCTION public.update_room_settings(uuid, text, jsonb, text[], integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.time_up_round(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rule_answer(uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stop_score_round(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_room_settings(uuid, text, jsonb, text[], integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.time_up_round(uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rule_answer(uuid, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_round(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_answers(uuid, text, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_stop(uuid, text, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_dispute(uuid, text, uuid, text) TO anon, authenticated;