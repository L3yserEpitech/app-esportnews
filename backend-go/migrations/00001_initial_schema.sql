-- Persistent tables only (5 tables)

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  avatar TEXT NULL,
  admin BOOLEAN NOT NULL DEFAULT FALSE,
  favorite_teams BIGINT[] NULL,
  notifi_push BOOLEAN NULL DEFAULT FALSE,
  notif_articles BOOLEAN NULL DEFAULT FALSE,
  notif_news BOOLEAN NULL DEFAULT FALSE,
  notif_matchs BOOLEAN NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.games (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT,
  selected_image TEXT,
  unselected_image TEXT,
  acronym TEXT,
  full_name TEXT
);

CREATE TABLE IF NOT EXISTS public.articles (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slug TEXT UNIQUE,
  tags TEXT[],
  title TEXT,
  views INTEGER DEFAULT 0,
  author TEXT,
  content TEXT,
  category TEXT,
  subtitle TEXT,
  description TEXT,
  content_black TEXT,
  content_white TEXT,
  "featuredImage" TEXT,
  "videoUrl" TEXT,
  "videoType" TEXT CHECK ("videoType" IN ('youtube', 'vimeo', 'mp4'))
);

CREATE TABLE IF NOT EXISTS public.ads (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT,
  position SMALLINT,
  type TEXT,
  url TEXT,
  redirect_link TEXT
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id BIGINT NOT NULL,
  notifi_push BOOLEAN NULL DEFAULT FALSE,
  notif_articles BOOLEAN NULL DEFAULT FALSE,
  notif_news BOOLEAN NULL DEFAULT FALSE,
  notif_matchs BOOLEAN NULL DEFAULT FALSE
);

-- Create indexes for persistent tables
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_articles_slug ON public.articles(slug);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
