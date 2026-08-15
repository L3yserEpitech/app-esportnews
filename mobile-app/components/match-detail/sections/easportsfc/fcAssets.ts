// EA Sports FC : les données Liquipedia n'exposent pas de stade exploitable
// (le champ "map" vaut "Game N", ignoré côté composant) et aucune source CDN
// publique d'images de stades n'est confirmée. Point d'entrée vide, prêt à être
// alimenté : nom → URL d'image, null → fallback typographique côté composant.
const STADIUM_FILES: Record<string, string> = {};

export function fcStadiumImage(name?: string | null): string | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return STADIUM_FILES[key] ?? null;
}
