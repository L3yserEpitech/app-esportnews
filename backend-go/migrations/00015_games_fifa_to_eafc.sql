-- Le jeu s'appelle EA Sports FC depuis 2023, plus FIFA. `full_name` était déjà
-- correct, mais `name` — le libellé affiché sous la carte du sélecteur de jeux —
-- annonçait encore FIFA, en contradiction avec sa propre cover (« EA SPORTS FC »).
--
-- L'acronyme reste `fifa` : il n'est jamais affiché, il sert de clé dans
-- GameWikiMapping, gameRegistry et les tables de covers des deux clients. Le
-- renommer serait un changement à large rayon sans bénéfice visible.

UPDATE games
SET name = 'EA FC'
WHERE acronym = 'fifa';
