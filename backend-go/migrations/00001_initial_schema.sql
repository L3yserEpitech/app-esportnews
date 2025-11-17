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

CREATE TABLE IF NOT EXISTS public.tournaments (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  panda_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT,
  type TEXT,
  status TEXT,
  begin_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  region TEXT,
  tier TEXT,
  prizepool TEXT,
  has_bracket BOOLEAN DEFAULT FALSE,
  videogame_id BIGINT,
  league_id BIGINT,
  serie_id BIGINT,
  winner_id BIGINT,
  modified_at TIMESTAMPTZ,
  raw_data JSONB
);

CREATE TABLE IF NOT EXISTS public.matches (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  panda_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT,
  status TEXT,
  match_type TEXT,
  number_of_games INTEGER,
  begin_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  original_scheduled_at TIMESTAMPTZ,
  tournament_id BIGINT REFERENCES public.tournaments(id),
  serie_id BIGINT,
  league_id BIGINT,
  winner_id BIGINT,
  winner_type TEXT,
  rescheduled BOOLEAN DEFAULT FALSE,
  forfeit BOOLEAN DEFAULT FALSE,
  draw BOOLEAN DEFAULT FALSE,
  detailed_stats BOOLEAN DEFAULT FALSE,
  game_advantage TEXT,
  live_supported BOOLEAN DEFAULT FALSE,
  live_url TEXT,
  modified_at TIMESTAMPTZ,
  raw_data JSONB
);

CREATE TABLE IF NOT EXISTS public.games_pandascore (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  panda_id BIGINT NOT NULL UNIQUE,
  match_id BIGINT NOT NULL REFERENCES public.matches(id),
  position INTEGER,
  status TEXT,
  length INTEGER,
  finished BOOLEAN DEFAULT FALSE,
  complete BOOLEAN DEFAULT FALSE,
  begin_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  forfeit BOOLEAN DEFAULT FALSE,
  winner_id BIGINT,
  winner_type TEXT,
  detailed_stats BOOLEAN DEFAULT FALSE,
  modified_at TIMESTAMPTZ,
  raw_data JSONB
);

-- Create indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_articles_slug ON public.articles(slug);
CREATE INDEX idx_tournaments_panda_id ON public.tournaments(panda_id);
CREATE INDEX idx_tournaments_videogame_id ON public.tournaments(videogame_id);
CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_matches_panda_id ON public.matches(panda_id);
CREATE INDEX idx_matches_tournament_id ON public.matches(tournament_id);
CREATE INDEX idx_matches_begin_at ON public.matches(begin_at);
CREATE INDEX idx_games_pandascore_match_id ON public.games_pandascore(match_id);
CREATE INDEX idx_games_pandascore_panda_id ON public.games_pandascore(panda_id);
