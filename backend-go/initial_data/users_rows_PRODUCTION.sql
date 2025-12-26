--
-- PostgreSQL database dump
--

\restrict 0YfK4g3Yf8QHwLv6HeNuF97NlTnzgYwTpajuoqMQaOnTvfZ9lnJ89hmICHnDYg6

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
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, created_at, name, email, password, avatar, admin, age, favorite_teams, notifi_push, notif_articles, notif_news, notif_matchs, premium, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_created_at, subscription_updated_at, subscription_current_period_start, subscription_current_period_end, subscription_canceled_at) FROM stdin;
4	2025-10-09 05:11:43.705096+00	admin	root@gmail.com	$2b$10$AvX0xU2oyACsJJnba26nT.bq9gFvCEEIzpmIX4SxVJY3mA7lUHf1S	https://olybccviffjiqjmnsysn.supabase.co/storage/v1/object/public/profilePictureUsers/avatars/4-1760815214247.ico	t	\N	{129919,3318,137296,128796}	f	f	t	t	f	\N	\N	\N	\N	\N	\N	\N	\N
10	2025-10-19 19:18:26.616518+00	Kenan Altarac 	altakenan@hotmail.fr	$2b$10$09ASaERgM7.HQqDtuP/fAOv4SBZr6JIixblIleCKxCzCPUwkmbQNa	\N	t	\N	{115,3455,134452,134213,128268,129570,126061}	t	t	t	t	f	\N	\N	\N	\N	\N	\N	\N	\N
13	2025-10-20 13:16:23.2859+00	BERRO95	berat.al@outlook.fr	$2b$10$X9Htt0UzVtTW32YqxztPOuSARhnwWEp7DfyfchSCIVlOrEM1xkQs.	\N	f	\N	{3455}	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
14	2025-10-21 16:26:02.661578+00	Maëla 	maela@parnasse-edition.com	$2b$10$25GH6frXZQqxdIk4twuA1eUdA.gwQh927L/VlxgMY2AsBp/kOwdSy	\N	f	\N	{133115,134213,134452,135374,137296,115}	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
15	2025-10-30 08:33:19.105587+00	Aristide Benyayer	aristide.bc@gmail.com	$2b$10$joTUlQzbjmZkpnFKcB7we.rsZKv4AyT.issQ5mGWg34EcupgDDZhO	\N	f	\N	{130384,1449}	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
16	2025-11-02 19:33:41.655015+00	Ayman Messaoudi	aymen.mess1995@gmail.com	$2b$10$bTxF.QEbBhNt3ErnQraL8OfoqbGRj9S4lFezEo6KxB6wJ2K1e9RRW	\N	f	\N	\N	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
17	2025-11-03 17:44:31.525021+00	Raphael Jamen	jamenraphael@gmail.com	$2b$10$xx9L7nBSG0RJG/ttLRhcOOyE09rG2c5t3aKkLea0b3mbhqNGaxpT.	\N	f	\N	\N	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
18	2025-11-03 19:20:00.47921+00	Anatole.cp	anatole.collin.pitel@gmail.com	$2b$10$yp8HDhClaT5RMLm/REvepupEQvohfhbnWDtUNrmDVITuj7o7w/UbO	\N	f	\N	\N	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
19	2025-11-03 20:47:01.786456+00	Ewen Messé 	ewenmesse18@gmail.com	$2b$10$leZJV1wrLWD/xZE6tjpENOQ7Z6DcwJFjJBhw4Slwl6PXG.JeblV2m	\N	f	\N	\N	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
20	2025-11-14 14:41:43.70219+00	Gauthier delalandre	gauthier.delalandre@gmail.com	$2b$10$kqrWsENl2JtX6boqsSa.u.ZOMegE48gLtGpVUdb1ZRL4ghXZRX1Y6	\N	f	\N	\N	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
21	2025-11-14 15:14:54.121333+00	Enzo Oudart	enzo.oudart59@gmail.com	$2b$10$jmLfngbNKpdQ3uoh2V1AjeyEQME7y92WyjCyBW4s0U8i85PKh2XUi	\N	f	\N	\N	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
1	2025-12-12 09:51:05.163764+00	Pumbaa	Pumbaa_91@proton.me	$2a$12$iM2ITT.vFWGJtfwwWqQlIuU3Oq.FMtTL9KFbYi13Z.FaXt2d13/aa	\N	f	22	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
11	2025-10-20 10:59:05.910712+00	Samuel COHEN	samuel@esportnews.fr	$2b$10$odZ7djb.jCFDMSyNbiv7B.cOVUb57I9ih2DTWSDcdcFRNP0iCE.dW	\N	t	\N	{91,49,51,55,54,51,50,93}	f	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
2	2025-12-22 16:15:24.080963+00	Coline Lamiré 	coline.lamire@gmail.com	$2a$12$d4Q5/uNRADTSdgMbyUpO5OOPtfzLVfSebeB32zbpLDY9vjCMNNPAW	\N	f	22	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
3	2025-12-22 16:24:07.617844+00	Evan Bouet	bouet.evan@gmail.com	$2a$12$f2Kr9kxw.l7o14gZBMWJWOrRgVY1bRmtgVCRCGbd6.Cr11LUpfmcK	\N	f	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
5	2025-12-22 16:29:09.958075+00	Nunosossa	mborobertonguyhenri@gmail.com	$2a$12$w70/vWFFhNtZcMK3TU2jK.dyoRVN8lzDcPlcn2Ew7wjUAXFu1tpdC	\N	f	24	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
6	2025-12-22 16:34:18.916626+00	Kevin Godart 	kiwin82170@hotmail.fr	$2a$12$/79V9AZ1nAg4li1/voRy1O/0nGVxsmT21jMb2D4695ThS.1ukzEbW	\N	f	33	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
7	2025-12-22 16:51:32.657229+00	Jean L7c	lucj3201@gmail.com	$2a$12$UHvEgAaAxW.u.8HMMAU5FOM04EhzADzS.sqEdn09UuVNpstr5IGJK	\N	f	25	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
8	2025-12-22 17:11:49.138834+00	David Frédéric 	alfred38260@gmail.com	$2a$12$JzqnF6pqBdUMkoUsj.0iA.y2jGjRt5jAL0057sXWbxCqW4sPNPsca	\N	f	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
9	2025-12-22 17:26:11.659886+00	Lawniczak arnaud	nash_terra@hotmail.fr	$2a$12$UPO5d.HXQ5Aj7qyOWc8Q7.CPIspiI8T1eNEy9FISmR8FxVLlcSyEa	\N	f	39	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
12	2025-12-22 17:50:00.942798+00	pourplanque 	kantinho@live.fr	$2a$12$EwHrsZcvQ3W5Uxe.ogGJ5.L2sjJeAE.zvuRtoz8v/.CXXD8TF2gLy	\N	f	34	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
22	2025-12-22 18:52:50.194194+00	Lohan Coquel	lohancoq@gmail.com	$2a$12$8Fa3Xs3xtXgqlbpPR3oT9OHErzKmIfIKiAEAxJ2pUWcNmCY2ZE6e2	\N	f	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
23	2025-12-22 18:56:00.908619+00	Dragounet 	dragounet439@gmail.com	$2a$12$tS/TJT9RZpDMHowa/NvTaunuLbWhhhn8.K6pt/iblHGtXvlWOtdQK	\N	f	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
24	2025-12-22 18:59:08.338404+00	Frogzito 	philippegael22@icloud.com	$2a$12$hjkWrEmcHt6HxJSOBKkS/efamyBlH7iojO0outNU18k8673C.LZt6	\N	f	28	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
25	2025-12-22 19:07:54.195795+00	Cayrol louan	cayrol.louan@gmail.com	$2a$12$9y3smg/unRwNW2A4pHzTkeQXjbUu3.CG7tF.O4Ft7dUE2DraxD7VK	\N	f	26	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
26	2025-12-22 20:10:32.172025+00	Mistretta Enzo	shaayaisemt@gmail.com	$2a$12$FZ/PqRiaKiLYtl1oAcMb8OW08uEd60eUjT2nv6KQw9N.likBufZlu	\N	f	23	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
27	2025-12-22 20:26:20.591127+00	alexandre Bringuier	alexandre.bringuier@hotmail.fr	$2a$12$wVvZ/9AVlLpHbsh9hVyWhezi8jWV5TBdCN8udK66dd2qbncXHb9rS	\N	f	35	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
28	2025-12-22 20:28:46.475135+00	Timothée Foulongani	Flckftfb5@gmail.com	$2a$12$g5Br/hdCn7Oq9scP5pF4Qu9LTODbGupKpoavp.8BVbPjTxObsvtEO	\N	f	20	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
29	2025-12-23 08:42:30.502537+00	Enzo	yl3315203@gmail.com	$2a$12$RB5Vp0rvylXytIu2XfVaouo.54Ivk9n44XafoGTCUNDuNj8hn8rG6	\N	f	24	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
30	2025-12-23 09:02:04.808459+00	Belkahla 	syuuae@gmail.com	$2a$12$lKT0fD9Un0rkpNeaTJTXzuQ1K.1CU8P4eWcPks/q7u6RhRZoB0pmu	\N	f	17	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
31	2025-12-23 09:07:24.059921+00	arkazy	evanpasteur56@gmail.com	$2a$12$qkbRnivyMq6xvuKRzHoMfuoE.uszo1LMH6MpFmWQ8vJrGuPQz4l5q	\N	f	16	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
32	2025-12-23 11:14:53.213439+00	Krayzz	portaliernolan1@gmail.com	$2a$12$/cFCuDiZBIBaHnKzjIc7DeVuPAmtK3T2j7fmXIBCXLonMQ0f8u4ma	\N	f	19	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
33	2025-12-23 12:48:48.82932+00	POLAR-ALPHA 	polaralpha29@gmail.com	$2a$12$xeiFXyRezQgYJ7sDw09l2./3hAHIjIK0PaIJJDwn16KejnabnDABW	\N	f	19	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
34	2025-12-23 13:53:19.189873+00	Muhammed-Selman Sen	mselmansen@gmail.com	$2a$12$rYKKUPEFM6Tn8DKdDyswA.D4qL2uju8IIXmFIufo/UEHu0oI0uDQi	\N	f	19	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
35	2025-12-24 01:29:43.783409+00	Cecilien Aguilar-mir	cecilien77@gmail.com	$2a$12$/vdNiTBsGHrBN6ZlscQi5OHXkFzZ8lueaxgiy73LkXxQPsg3iqx5C	\N	f	22	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
36	2025-12-24 09:22:54.768075+00	Yildirim Okan	okan45150@free.fr	$2a$12$kA7nLR79HUzXMHSOtsVxk.555QFO9m4R7oBIamZCAIcvGZw32CCnm	\N	f	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
37	2025-12-24 10:26:20.521071+00	Bastien 	klurbastien1@gmail.com	$2a$12$lsJYwiWOdp9DtEASVE2rjOAK08W0LctxmKs1kiLsrGJyzGq5WVOoS	\N	f	20	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
38	2025-12-24 10:53:22.246103+00	Facquez Theo	theo.facquez@orange.fr	$2a$12$JR/pqHprGijOnmL1inizG.x8iGfRMY0ip.naVv/Z84.hNy.TLgYX6	\N	f	26	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
39	2025-12-24 11:02:47.809152+00	Jawad A.	les.fondateurs.003@gmail.com	$2a$12$MslgdEamXStKYbj0v/k38.dk2pNATr2Cq1JRY9RUOKLZJ9bOLkADa	\N	f	23	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 39, true);


--
-- PostgreSQL database dump complete
--

\unrestrict 0YfK4g3Yf8QHwLv6HeNuF97NlTnzgYwTpajuoqMQaOnTvfZ9lnJ89hmICHnDYg6

