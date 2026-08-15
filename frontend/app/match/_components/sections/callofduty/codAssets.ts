// Mapping statique nom de map Liquipedia → URL image.
// Aucune source publique fiable n'existe pour les screenshots CODM en 2026 :
// l'officielle Activision renvoie 403, le wiki fandom bloque le hotlink.
// On assume donc le fallback typographique partout — si une source apparaît,
// il suffit d'alimenter MAP_FILES avec les URLs vérifiées.
const MAP_FILES: Record<string, string> = {};

export function codMapImage(name?: string | null): string | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return MAP_FILES[key] ?? null;
}
