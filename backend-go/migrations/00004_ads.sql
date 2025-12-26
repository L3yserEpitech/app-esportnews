--
-- PostgreSQL database dump
--

\restrict Iu32fkzG57QlMsv12gjYLgF4Cur7nlsQHcb9nuWbgS6M2rco9mCd75JFbaWG01K

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: ads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ads (id, created_at, title, "position", type, url, redirect_link) FROM stdin;
4	2025-01-01 05:49:41.171976+00	App	2	image	https://i.postimg.cc/tJR6dFw0/disponible-aussi-en-application.png	https://www.mybusinessevent.com/
9	2025-01-01 18:20:24.050305+00	Business Event	1	image	https://i.postimg.cc/4dWTHGjY/ae6fcc08-087b-42f6-9af2-26872cb532c9.jpg	https://www.mybusinessevent.com/
\.


--
-- Name: ads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ads_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict Iu32fkzG57QlMsv12gjYLgF4Cur7nlsQHcb9nuWbgS6M2rco9mCd75JFbaWG01K

