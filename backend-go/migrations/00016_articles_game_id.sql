-- Jeu associé à un article/actu (dropdown de l'admin), NULL = aucun.
-- Le backend applique aussi ces instructions au démarrage (internal/database/gorm.go),
-- ce fichier documente le schéma pour une base créée à la main.
ALTER TABLE IF EXISTS public.articles
  ADD COLUMN IF NOT EXISTS game_id bigint REFERENCES public.games(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_articles_game_id ON public.articles(game_id);
