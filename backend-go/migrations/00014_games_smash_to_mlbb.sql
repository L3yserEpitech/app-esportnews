-- Le 10e slot passe de Super Smash Bros. Ultimate à Mobile Legends: Bang Bang.
--
-- Motif : Liquipedia référence les tournois Smash Ultimate mais ne remplit
-- jamais match2 pour eux. Vérifié le 2026-08-08 contre l'API : aucun match
-- n'y porte game::ultimate (ni ssbu, ni smashultimate), et même sans aucun
-- filtre le wiki smash renvoie 0 match sur 30 jours et 0 à venir. Le jeu ne
-- pouvait donc afficher aucun match, jamais. mobilelegends : 627 matchs / 30j.
--
-- Le seed 00003_games.sql décrit l'état initial et ne rejoue pas sur une base
-- déjà initialisée, d'où cet UPDATE. Le sélecteur de jeux résout sa cover
-- locale depuis `acronym` : il doit valoir `mlbb`.
--
-- selected_image / unselected_image pointent encore sur l'artwork Wild Rift
-- hérité : sans effet sur le sélecteur (la cover locale prime) mais visible
-- sur /jeux/[game] et RunningTournaments. À remplacer par un upload R2.

UPDATE games
SET name = 'MLBB',
    acronym = 'mlbb',
    full_name = 'Mobile Legends: Bang Bang'
WHERE acronym IN ('smash', 'lol-wild-rift');
