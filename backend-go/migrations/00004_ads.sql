-- Import ads data from Supabase
-- ON CONFLICT DO NOTHING ensures idempotent execution
-- Note: created_at was TIME format from Supabase, converted to TIMESTAMPTZ with default date

INSERT INTO "public"."ads" ("id", "created_at", "title", "position", "type", "url", "redirect_link") VALUES
('4', '2025-01-01 05:49:41.171976+00', 'App', 2, 'image', 'https://i.postimg.cc/tJR6dFw0/disponible-aussi-en-application.png', 'https://www.mybusinessevent.com/'),
('9', '2025-01-01 18:20:24.050305+00', 'Business Event', 1, 'image', 'https://i.postimg.cc/4dWTHGjY/ae6fcc08-087b-42f6-9af2-26872cb532c9.jpg', 'https://www.mybusinessevent.com/')
ON CONFLICT (id) DO NOTHING;
