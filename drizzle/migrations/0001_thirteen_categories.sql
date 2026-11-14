-- 13 categories. Must stay in sync with CATEGORIES in src/lib/game.ts.
CREATE OR REPLACE FUNCTION public.stop_categories()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY['nome','cidade','estado','cep','cor','comida','fruta','filme','sogra','animal','objeto','profissao','marca']::text[]
$$;