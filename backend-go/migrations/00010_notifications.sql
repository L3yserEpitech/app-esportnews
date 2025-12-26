--
-- PostgreSQL database dump
--

\restrict 6gBPeUqQUZapTdKMmx8EhbaxNl6QqKuEIxclmyjAFhYCb3FlVJwGGskWpJbzuPP

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
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, created_at, user_id, notifi_push, notif_articles, notif_news, notif_matchs) FROM stdin;
\.


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict 6gBPeUqQUZapTdKMmx8EhbaxNl6QqKuEIxclmyjAFhYCb3FlVJwGGskWpJbzuPP

