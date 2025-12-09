-- Import user data from Supabase
-- ON CONFLICT DO NOTHING ensures idempotent execution
-- Note: Arrays are corrected from Supabase export format to PostgreSQL format

INSERT INTO "public"."users" ("id", "created_at", "name", "email", "password", "avatar", "admin", "favorite_teams", "notifi_push", "notif_articles", "notif_news", "notif_matchs") VALUES
('4', '2025-10-09 05:11:43.705096+00', 'admin', 'root@gmail.com', '$2b$10$AvX0xU2oyACsJJnba26nT.bq9gFvCEEIzpmIX4SxVJY3mA7lUHf1S', 'https://olybccviffjiqjmnsysn.supabase.co/storage/v1/object/public/profilePictureUsers/avatars/4-1760815214247.ico', true, ARRAY[129919,3318,137296,128796], false, false, true, true),
('10', '2025-10-19 19:18:26.616518+00', 'Kenan Altarac ', 'altakenan@hotmail.fr', '$2b$10$09ASaERgM7.HQqDtuP/fAOv4SBZr6JIixblIleCKxCzCPUwkmbQNa', null, true, ARRAY[115,3455,134452,134213,128268,129570,126061], true, true, true, true),
('11', '2025-10-20 10:59:05.910712+00', 'Samuel COHEN', 'samuel@esportnews.fr', '$2b$10$odZ7djb.jCFDMSyNbiv7B.cOVUb57I9ih2DTWSDcdcFRNP0iCE.dW', null, true, null, false, false, false, null),
('13', '2025-10-20 13:16:23.2859+00', 'BERRO95', 'berat.al@outlook.fr', '$2b$10$X9Htt0UzVtTW32YqxztPOuSARhnwWEp7DfyfchSCIVlOrEM1xkQs.', null, false, ARRAY[3455], false, false, false, null),
('14', '2025-10-21 16:26:02.661578+00', 'Maëla ', 'maela@parnasse-edition.com', '$2b$10$25GH6frXZQqxdIk4twuA1eUdA.gwQh927L/VlxgMY2AsBp/kOwdSy', null, false, ARRAY[133115,134213,134452,135374,137296,115], false, false, false, null),
('15', '2025-10-30 08:33:19.105587+00', 'Aristide Benyayer', 'aristide.bc@gmail.com', '$2b$10$joTUlQzbjmZkpnFKcB7we.rsZKv4AyT.issQ5mGWg34EcupgDDZhO', null, false, ARRAY[130384,1449], false, false, false, null),
('16', '2025-11-02 19:33:41.655015+00', 'Ayman Messaoudi', 'aymen.mess1995@gmail.com', '$2b$10$bTxF.QEbBhNt3ErnQraL8OfoqbGRj9S4lFezEo6KxB6wJ2K1e9RRW', null, false, null, false, false, false, null),
('17', '2025-11-03 17:44:31.525021+00', 'Raphael Jamen', 'jamenraphael@gmail.com', '$2b$10$xx9L7nBSG0RJG/ttLRhcOOyE09rG2c5t3aKkLea0b3mbhqNGaxpT.', null, false, null, false, false, false, null),
('18', '2025-11-03 19:20:00.47921+00', 'Anatole.cp', 'anatole.collin.pitel@gmail.com', '$2b$10$yp8HDhClaT5RMLm/REvepupEQvohfhbnWDtUNrmDVITuj7o7w/UbO', null, false, null, false, false, false, null),
('19', '2025-11-03 20:47:01.786456+00', 'Ewen Messé ', 'ewenmesse18@gmail.com', '$2b$10$leZJV1wrLWD/xZE6tjpENOQ7Z6DcwJFjJBhw4Slwl6PXG.JeblV2m', null, false, null, false, false, false, null),
('20', '2025-11-14 14:41:43.70219+00', 'Gauthier delalandre', 'gauthier.delalandre@gmail.com', '$2b$10$kqrWsENl2JtX6boqsSa.u.ZOMegE48gLtGpVUdb1ZRL4ghXZRX1Y6', null, false, null, false, false, false, null),
('21', '2025-11-14 15:14:54.121333+00', 'Enzo Oudart', 'enzo.oudart59@gmail.com', '$2b$10$jmLfngbNKpdQ3uoh2V1AjeyEQME7y92WyjCyBW4s0U8i85PKh2XUi', null, false, null, false, false, false, null),
ON CONFLICT (email) DO NOTHING;
