'use client';
// Steam CDN pour les images héros/items ; le mapping nom affiché → chemin
// d'image vient de dotaconstants (odota, GitHub raw), fetché une seule fois à
// la première page de match Dota — ~600 KB à deux, browser-cached, et toujours
// à jour (les nouveaux héros y arrivent vite). Nom inconnu → null → fallback.
import { useEffect, useState } from 'react';

const STEAM_CDN = 'https://cdn.steamstatic.com';
const CONSTANTS = 'https://raw.githubusercontent.com/odota/dotaconstants/master/build';

export type DotaAssetMaps = {
  heroes: Record<string, string>; // localized_name → chemin image (landscape 256×144)
  items: Record<string, string>; // dname → chemin image
};

let mapsCache: DotaAssetMaps | null = null;
let mapsPromise: Promise<DotaAssetMaps> | null = null;

const stripQuery = (p: string): string => p.split('?')[0];

function loadMaps(): Promise<DotaAssetMaps> {
  mapsPromise ??= Promise.all([
    fetch(`${CONSTANTS}/heroes.json`).then(r => r.json()),
    fetch(`${CONSTANTS}/items.json`).then(r => r.json()),
  ])
    .then(([heroesRaw, itemsRaw]: [Record<string, { localized_name: string; img?: string }>, Record<string, { dname?: string; img?: string }>]) => {
      const heroes: Record<string, string> = {};
      for (const h of Object.values(heroesRaw)) {
        if (h.localized_name && h.img) heroes[h.localized_name.toLowerCase()] = stripQuery(h.img);
      }
      const items: Record<string, string> = {};
      for (const it of Object.values(itemsRaw)) {
        if (it.dname && it.img) items[it.dname.toLowerCase()] = stripQuery(it.img);
      }
      mapsCache = { heroes, items };
      return mapsCache;
    })
    .catch(() => (mapsCache = { heroes: {}, items: {} }));
  return mapsPromise;
}

export function useDotaAssets(): DotaAssetMaps | null {
  const [maps, setMaps] = useState(mapsCache);
  useEffect(() => {
    if (!mapsCache) loadMaps().then(setMaps);
  }, []);
  return maps;
}

export function dotaHeroImage(name: string | null | undefined, maps: DotaAssetMaps | null): string | null {
  const path = name ? maps?.heroes[name.toLowerCase().trim()] : null;
  return path ? `${STEAM_CDN}${path}` : null;
}

export function dotaItemIcon(name: string | null | undefined, maps: DotaAssetMaps | null): string | null {
  const path = name ? maps?.items[name.toLowerCase().trim()] : null;
  return path ? `${STEAM_CDN}${path}` : null;
}

// Couleurs de side : Radiant vert, Dire rouge.
export const DOTA_SIDE_CLASS: Record<string, string> = {
  radiant: 'text-emerald-400',
  dire: 'text-red-400',
};

export const dotaSideDot = (side: unknown): string | null =>
  side === 'radiant' ? 'bg-emerald-400' : side === 'dire' ? 'bg-red-500' : null;
