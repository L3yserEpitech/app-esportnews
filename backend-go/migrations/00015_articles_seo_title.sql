-- Balise <title> dédiée (60 caractères), saisie dans l'admin ; NULL = titre éditorial.
-- Le backend applique aussi cette instruction au démarrage (internal/database/gorm.go),
-- ce fichier documente le schéma pour une base créée à la main.
ALTER TABLE IF EXISTS public.articles ADD COLUMN IF NOT EXISTS seo_title text;
