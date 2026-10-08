-- dateModified / article:modified_time pour le SEO.
-- Le backend applique aussi ces instructions au démarrage (internal/database/gorm.go),
-- ce fichier documente le schéma pour une base créée à la main.
ALTER TABLE IF EXISTS public.articles ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.articles SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE IF EXISTS public.articles ALTER COLUMN updated_at SET DEFAULT now();
