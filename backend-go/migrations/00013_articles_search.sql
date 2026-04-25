-- Migration: Article full-text search
-- Date: 2026-04-25
--
-- Adds PostgreSQL full-text search to public.articles, used by the search
-- modal on /articles and /news. The frontend just calls
-- GET /api/articles/search?q=... and gets ranked, fuzzy-matched results
-- against the entire database — not the paginated client-side slice.
--
-- Strategy:
--   * tsvector column with weighted fields (title > tags/subtitle/category
--     > description > author), maintained by a trigger because generated
--     columns can't call to_tsvector(regconfig, text) (STABLE, not
--     IMMUTABLE) reliably across PG versions.
--   * unaccent() inside an IMMUTABLE wrapper so accents fold ("équipe" ==
--     "equipe") and the wrapper can be used inside expression indexes.
--   * pg_trgm similarity as a fuzzy fallback so misspellings still match
--     ("vlorant" -> "valorant").
--   * GIN indexes on the tsvector and on trigram-friendly title /
--     description so both branches stay fast as the corpus grows.
--
-- Apply on existing DBs with:
--   psql -U postgres -d esportnews -f migrations/00013_articles_search.sql

BEGIN;

-- On Supabase, extensions live in the `extensions` schema by default; on a
-- vanilla Postgres install they typically land in `public`. We don't
-- hardcode either: the wrapper below uses `SET search_path` so the runtime
-- resolves `unaccent` via whatever schema is on the path.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- The shipped unaccent() function is marked STABLE, which is not enough
-- for expression indexes. Wrap it in an IMMUTABLE function. We pin the
-- function's own search_path so it works regardless of how the caller
-- has theirs configured (and so the planner can inline it safely).
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent('unaccent', $1);
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE
SET search_path = public, extensions, pg_catalog;

-- Add the tsvector column if it doesn't exist yet.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Trigger function: rebuild search_vector whenever any of the indexed
-- columns change. Weights map to ts_rank_cd's A/B/C/D buckets so that
-- a hit in the title outranks a hit in the description.
CREATE OR REPLACE FUNCTION public.articles_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(NEW.title, ''))), 'A') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(NEW.subtitle, ''))), 'B') ||
    setweight(to_tsvector('french', public.immutable_unaccent(array_to_string(coalesce(NEW.tags, ARRAY[]::text[]), ' '))), 'B') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(NEW.category, ''))), 'B') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(NEW.description, ''))), 'C') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(NEW.author, ''))), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_search_vector_trigger ON public.articles;
CREATE TRIGGER articles_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, subtitle, description, category, tags, author
ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.articles_search_vector_update();

-- Backfill existing rows. We can't rely on `UPDATE ... SET id = id` to
-- fire the trigger above because UPDATE OF triggers only fire when one of
-- the listed columns is in the SET list (Postgres docs, CREATE TRIGGER).
-- Write search_vector directly so the backfill is independent of the
-- trigger plumbing.
UPDATE public.articles SET search_vector =
  setweight(to_tsvector('french', public.immutable_unaccent(coalesce(title, ''))), 'A') ||
  setweight(to_tsvector('french', public.immutable_unaccent(coalesce(subtitle, ''))), 'B') ||
  setweight(to_tsvector('french', public.immutable_unaccent(array_to_string(coalesce(tags, ARRAY[]::text[]), ' '))), 'B') ||
  setweight(to_tsvector('french', public.immutable_unaccent(coalesce(category, ''))), 'B') ||
  setweight(to_tsvector('french', public.immutable_unaccent(coalesce(description, ''))), 'C') ||
  setweight(to_tsvector('french', public.immutable_unaccent(coalesce(author, ''))), 'D');

-- GIN index for the tsvector @@ tsquery branch.
CREATE INDEX IF NOT EXISTS articles_search_vector_idx
  ON public.articles USING GIN (search_vector);

-- GIN trigram indexes for the fuzzy fallback (typos and partial matches).
CREATE INDEX IF NOT EXISTS articles_title_trgm_idx
  ON public.articles USING GIN (public.immutable_unaccent(coalesce(title, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS articles_description_trgm_idx
  ON public.articles USING GIN (public.immutable_unaccent(coalesce(description, '')) gin_trgm_ops);

COMMIT;
