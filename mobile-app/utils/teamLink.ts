type TeamLike = {
  id?: number | string | null;
  name?: string | null;
  template?: string | null;
} | null | undefined;

export type TeamRoute = {
  pathname: '/team/[id]';
  params: { id: string; wiki: string; template: string; name: string };
};

/**
 * Paramètres de navigation vers la page d'une équipe, ou `null` quand elle n'est
 * pas atteignable — auquel cas l'élément ne doit pas être rendu cliquable.
 *
 * L'`id` que portent les opponents de match et de tournoi est un hash du nom
 * d'équipe, pas un pageid Liquipedia : la page résout par `template`, avec le
 * nom en repli côté backend pour les équipes renommées (le template d'un match
 * de 2023 ne correspond plus à la fiche actuelle). Sans template ni wiki, il
 * n'y a rien à ouvrir.
 */
export function teamRoute(team: TeamLike, wiki?: string | null): TeamRoute | null {
  if (!team || !wiki) return null;

  const template = typeof team.template === 'string' ? team.template.trim() : '';
  if (!template) return null;

  return {
    pathname: '/team/[id]',
    params: {
      id: team.id != null ? String(team.id) : '',
      wiki,
      template,
      name: typeof team.name === 'string' ? team.name : '',
    },
  };
}
