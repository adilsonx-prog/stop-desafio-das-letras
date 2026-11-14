-- ============ TABLES ============
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','playing','stopped','results')),
  host_player_id uuid,
  current_letter text,
  round_number integer NOT NULL DEFAULT 0,
  used_letters text[] NOT NULL DEFAULT '{}',
  round_started_at timestamptz,
  stopped_by uuid,
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rooms are readable" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  last_round_points integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_players_room_idx ON public.room_players(room_id);
GRANT SELECT ON public.room_players TO anon, authenticated;
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players are readable" ON public.room_players FOR SELECT TO anon, authenticated USING (true);

-- Private: secret tokens that prove which device controls which player. No client access.
CREATE TABLE public.player_secrets (
  player_id uuid PRIMARY KEY REFERENCES public.room_players(id) ON DELETE CASCADE,
  secret uuid NOT NULL DEFAULT gen_random_uuid()
);
GRANT ALL ON public.player_secrets TO service_role;
ALTER TABLE public.player_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.round_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  player_id uuid NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  points jsonb NOT NULL DEFAULT '{}'::jsonb,
  total integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_number, player_id)
);
GRANT SELECT ON public.round_answers TO anon, authenticated;
GRANT ALL ON public.round_answers TO service_role;
ALTER TABLE public.round_answers ENABLE ROW LEVEL SECURITY;
-- Answers of the round in progress stay hidden until the round is scored.
CREATE POLICY "Finished round answers are readable" ON public.round_answers FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.rooms r
  WHERE r.id = round_answers.room_id
    AND (round_answers.round_number < r.round_number OR r.status IN ('results','lobby'))
));

-- ============ REALTIME ============
ALTER TABLE public.room_players REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.stop_categories()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY['nome','animal','cep','cor','comida','objeto','profissao','marca','filme']::text[]
$$;

CREATE OR REPLACE FUNCTION public.stop_normalize(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(
    lower(translate(trim(coalesce(t, '')),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
      'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
    '\s+', ' ', 'g')
$$;

CREATE OR REPLACE FUNCTION public.stop_clean_answers(p_answers jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_object_agg(k, left(trim(coalesce(p_answers->>k, '')), 40)), '{}'::jsonb)
  FROM unnest(public.stop_categories()) AS k
$$;

CREATE OR REPLACE FUNCTION public.stop_verify_player(p_player_id uuid, p_secret text)
RETURNS public.room_players LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players;
BEGIN
  SELECT p.* INTO v_player FROM public.room_players p
  JOIN public.player_secrets s ON s.player_id = p.id
  WHERE p.id = p_player_id AND s.secret::text = p_secret;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida. Entre na sala novamente.';
  END IF;
  RETURN v_player;
END $$;

-- ============ GAME ACTIONS ============
CREATE OR REPLACE FUNCTION public.create_room(p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := left(trim(coalesce(p_name, '')), 20);
  v_code text; v_room_id uuid; v_player_id uuid; v_secret uuid;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
BEGIN
  IF length(v_name) < 2 THEN RAISE EXCEPTION 'Digite um nome com pelo menos 2 letras.'; END IF;
  LOOP
    v_code := '';
    FOR i IN 1..5 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE code = v_code);
  END LOOP;
  INSERT INTO public.rooms(code) VALUES (v_code) RETURNING id INTO v_room_id;
  INSERT INTO public.room_players(room_id, name) VALUES (v_room_id, v_name) RETURNING id INTO v_player_id;
  INSERT INTO public.player_secrets(player_id) VALUES (v_player_id) RETURNING secret INTO v_secret;
  UPDATE public.rooms SET host_player_id = v_player_id WHERE id = v_room_id;
  RETURN jsonb_build_object('code', v_code, 'room_id', v_room_id, 'player_id', v_player_id, 'secret', v_secret);
END $$;

CREATE OR REPLACE FUNCTION public.join_room(p_code text, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := left(trim(coalesce(p_name, '')), 20);
  v_room public.rooms; v_player_id uuid; v_secret uuid;
BEGIN
  IF length(v_name) < 2 THEN RAISE EXCEPTION 'Digite um nome com pelo menos 2 letras.'; END IF;
  SELECT * INTO v_room FROM public.rooms WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala não encontrada. Confira o código.'; END IF;
  IF (SELECT count(*) FROM public.room_players WHERE room_id = v_room.id) >= 15 THEN
    RAISE EXCEPTION 'Sala cheia (máximo 15 jogadores).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.room_players WHERE room_id = v_room.id AND lower(name) = lower(v_name)) THEN
    RAISE EXCEPTION 'Já existe um jogador com esse nome na sala.';
  END IF;
  INSERT INTO public.room_players(room_id, name) VALUES (v_room.id, v_name) RETURNING id INTO v_player_id;
  INSERT INTO public.player_secrets(player_id) VALUES (v_player_id) RETURNING secret INTO v_secret;
  UPDATE public.rooms SET updated_at = now() WHERE id = v_room.id;
  RETURN jsonb_build_object('code', v_room.code, 'room_id', v_room.id, 'player_id', v_player_id, 'secret', v_secret);
END $$;

CREATE OR REPLACE FUNCTION public.check_player(p_player_id uuid, p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.player_secrets WHERE player_id = p_player_id AND secret::text = p_secret)
$$;

CREATE OR REPLACE FUNCTION public.leave_room(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms; v_next uuid;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  DELETE FROM public.room_players WHERE id = v_player.id;
  SELECT id INTO v_next FROM public.room_players WHERE room_id = v_room.id ORDER BY joined_at LIMIT 1;
  IF v_next IS NULL THEN
    DELETE FROM public.rooms WHERE id = v_room.id;
  ELSE
    UPDATE public.rooms SET
      host_player_id = CASE WHEN host_player_id = v_player.id THEN v_next ELSE host_player_id END,
      updated_at = now()
    WHERE id = v_room.id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.start_round(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player public.room_players; v_room public.rooms;
  v_letters text[] := string_to_array('A,B,C,D,E,F,G,H,I,J,L,M,N,O,P,R,S,T,U,V', ',');
  v_available text[]; v_letter text; v_used text[];
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.host_player_id <> v_player.id THEN RAISE EXCEPTION 'Só o anfitrião pode iniciar a rodada.'; END IF;
  IF v_room.status NOT IN ('lobby','results') THEN RAISE EXCEPTION 'A rodada já está em andamento.'; END IF;
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

CREATE OR REPLACE FUNCTION public.save_answers(p_player_id uuid, p_secret text, p_round integer, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id;
  -- Silently ignore late saves once the round is scored.
  IF v_room.status NOT IN ('playing','stopped') OR v_room.round_number <> p_round THEN RETURN; END IF;
  INSERT INTO public.round_answers(room_id, round_number, player_id, answers)
  VALUES (v_room.id, p_round, v_player.id, public.stop_clean_answers(p_answers))
  ON CONFLICT (room_id, round_number, player_id)
  DO UPDATE SET answers = EXCLUDED.answers, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.call_stop(p_player_id uuid, p_secret text, p_round integer, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms; v_clean jsonb; k text;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.status <> 'playing' OR v_room.round_number <> p_round THEN
    RAISE EXCEPTION 'Alguém já pediu STOP!';
  END IF;
  v_clean := public.stop_clean_answers(p_answers);
  FOREACH k IN ARRAY public.stop_categories() LOOP
    IF length(v_clean->>k) = 0 THEN RAISE EXCEPTION 'Preencha todas as categorias para pedir STOP.'; END IF;
  END LOOP;
  INSERT INTO public.round_answers(room_id, round_number, player_id, answers)
  VALUES (v_room.id, p_round, v_player.id, v_clean)
  ON CONFLICT (room_id, round_number, player_id)
  DO UPDATE SET answers = EXCLUDED.answers, updated_at = now();
  UPDATE public.rooms SET status = 'stopped', stopped_by = v_player.id, stopped_at = now(), updated_at = now()
  WHERE id = v_room.id;
END $$;

CREATE OR REPLACE FUNCTION public.finish_round(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player public.room_players; v_room public.rooms; v_ans public.round_answers;
  k text; n text; c int; pts int; v_points jsonb; v_total int; v_letter text;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.status <> 'stopped' THEN RETURN; END IF;
  -- Host scores the round; anyone may do it if the host is gone for 8s.
  IF v_room.host_player_id <> v_player.id AND v_room.stopped_at > now() - interval '8 seconds' THEN RETURN; END IF;
  v_letter := lower(v_room.current_letter);
  UPDATE public.room_players SET last_round_points = 0 WHERE room_id = v_room.id;
  FOR v_ans IN SELECT * FROM public.round_answers WHERE room_id = v_room.id AND round_number = v_room.round_number LOOP
    v_points := '{}'::jsonb; v_total := 0;
    FOREACH k IN ARRAY public.stop_categories() LOOP
      n := public.stop_normalize(v_ans.answers->>k);
      IF length(n) >= 2 AND left(n, 1) = v_letter THEN
        SELECT count(*) INTO c FROM public.round_answers o
        WHERE o.room_id = v_room.id AND o.round_number = v_room.round_number
          AND public.stop_normalize(o.answers->>k) = n;
        pts := CASE WHEN c > 1 THEN 5 ELSE 10 END;
      ELSE
        pts := 0;
      END IF;
      v_points := v_points || jsonb_build_object(k, pts);
      v_total := v_total + pts;
    END LOOP;
    UPDATE public.round_answers SET points = v_points, total = v_total WHERE id = v_ans.id;
    UPDATE public.room_players SET score = score + v_total, last_round_points = v_total WHERE id = v_ans.player_id;
  END LOOP;
  UPDATE public.rooms SET status = 'results', updated_at = now() WHERE id = v_room.id;
END $$;

CREATE OR REPLACE FUNCTION public.reset_room(p_player_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.room_players; v_room public.rooms;
BEGIN
  v_player := public.stop_verify_player(p_player_id, p_secret);
  SELECT * INTO v_room FROM public.rooms WHERE id = v_player.room_id FOR UPDATE;
  IF v_room.host_player_id <> v_player.id THEN RAISE EXCEPTION 'Só o anfitrião pode reiniciar a partida.'; END IF;
  UPDATE public.room_players SET score = 0, last_round_points = 0 WHERE room_id = v_room.id;
  UPDATE public.rooms SET status = 'lobby', current_letter = NULL, used_letters = '{}',
    stopped_by = NULL, stopped_at = NULL, updated_at = now()
  WHERE id = v_room.id;
END $$;

-- ============ PERMISSIONS ============
REVOKE ALL ON FUNCTION public.stop_verify_player(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_room(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_room(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_player(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_room(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_round(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_answers(uuid, text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.call_stop(uuid, text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_round(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_room(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_room(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_room(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_player(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_round(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_answers(uuid, text, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_stop(uuid, text, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_round(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_room(uuid, text) TO anon, authenticated;
