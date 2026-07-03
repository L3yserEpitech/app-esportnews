// Aucune source CDN d'images d'arènes RL n'a pu être confirmée (octane.gg 404,
// rocketleague.com 403) → retour null systématique, le composant applique un
// dégradé navy à la place. Ce module reste le point d'entrée unique à enrichir
// si un CDN public stable émerge un jour.

// Arènes observées dans les données Liquipedia au 2026-07 :
// "Champions Field", "DFH Stadium", "Forbidden Temple", "Mannfield",
// "Mannfield (Night)", "Neo Tokyo", "Parc de Paris", "Utopia Coliseum (Dusk)"

// Mapping statique prêt à être complété : arena normalisée → URL d'image.
// La normalisation consiste à supprimer les variantes de suffixe entre
// parenthèses ("(Night)", "(Dusk)", etc.) et à mettre en minuscules.
const ARENA_IMAGES: Record<string, string> = {
  // Exemple si un CDN était disponible :
  // 'dfh stadium': 'https://cdn.example.com/rl/dfh_stadium.jpg',
};

/**
 * Retourne l'URL de l'image d'arène ou null (→ dégradé côté composant).
 * Essaie d'abord le nom complet normalisé, puis le nom sans variante de suffixe.
 */
export function rlArenaImage(name?: string | null): string | null {
  if (!name) return null;

  const key = name.toLowerCase().trim();
  if (ARENA_IMAGES[key]) return ARENA_IMAGES[key];

  // Retire la variante entre parenthèses ex. "(Night)" pour essayer la base.
  const base = key.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return ARENA_IMAGES[base] ?? null;
}
