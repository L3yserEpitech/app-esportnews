// Super Smash Bros. Ultimate : point d'entrée vide. Aucune source CDN publique
// stable n'est encore câblée pour les portraits de personnages ou les images de
// stages. Mapping statique prêt à être complété : nom → URL d'image, null →
// fallback typographique côté composant.
const CHARACTER_FILES: Record<string, string> = {};

export function smashCharacterImage(name?: string | null): string | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return CHARACTER_FILES[key] ?? null;
}
