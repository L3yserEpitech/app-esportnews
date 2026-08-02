'use client';
// Data Dragon (CDN officiel Riot) — champions, sorts d'invocateur, items.
// Splashs non versionnés ; icônes versionnées (bump DDRAGON_VER à l'occasion).
// Pas de photos de joueurs pros ici non plus (comme valorant-api).
import { useEffect, useState } from 'react';

export const DDRAGON_VER = '16.13.1';
const CDN = 'https://ddragon.leagueoflegends.com/cdn';

// Liquipedia donne les noms affichés ; DDragon veut sa clé interne. La règle
// par défaut (strip non-alphanumérique) couvre presque tout ("Lee Sin"→LeeSin,
// "Jarvan IV"→JarvanIV, "Kog'Maw"→KogMaw) — ici uniquement les irréguliers.
const CHAMP_KEY_EXCEPTIONS: Record<string, string> = {
  "kai'sa": 'Kaisa',
  "cho'gath": 'Chogath',
  "kha'zix": 'Khazix',
  "vel'koz": 'Velkoz',
  "bel'veth": 'Belveth',
  leblanc: 'Leblanc',
  wukong: 'MonkeyKing',
  'renata glasc': 'Renata',
  'nunu & willump': 'Nunu',
};

function champKey(name?: string | null): string | null {
  if (!name) return null;
  return CHAMP_KEY_EXCEPTIONS[name.toLowerCase().trim()] ?? name.replace(/[^a-zA-Z0-9]/g, '');
}

export function lolChampSplash(name?: string | null): string | null {
  const key = champKey(name);
  return key ? `${CDN}/img/champion/splash/${key}_0.jpg` : null;
}

export function lolChampIcon(name?: string | null): string | null {
  const key = champKey(name);
  return key ? `${CDN}/${DDRAGON_VER}/img/champion/${key}.png` : null;
}

const SPELL_KEYS: Record<string, string> = {
  flash: 'SummonerFlash',
  smite: 'SummonerSmite',
  ignite: 'SummonerDot',
  teleport: 'SummonerTeleport',
  heal: 'SummonerHeal',
  barrier: 'SummonerBarrier',
  exhaust: 'SummonerExhaust',
  cleanse: 'SummonerBoost',
  ghost: 'SummonerHaste',
};

export function lolSpellIcon(name?: string | null): string | null {
  const key = name ? SPELL_KEYS[name.toLowerCase().trim()] : null;
  return key ? `${CDN}/${DDRAGON_VER}/img/spell/${key}.png` : null;
}

// Liquipedia nomme les items ("Heartsteel") ; DDragon les référence par ID.
// item.json (~80 KB gzip, browser-cached) est fetché une seule fois, à la
// première page de match LoL — le mapping vit ensuite au niveau module.
let itemMapCache: Record<string, string> | null = null;
let itemMapPromise: Promise<Record<string, string>> | null = null;

function loadItemMap(): Promise<Record<string, string>> {
  itemMapPromise ??= fetch(`${CDN}/${DDRAGON_VER}/data/en_US/item.json`)
    .then(r => r.json())
    .then((d: { data: Record<string, { name: string }> }) => {
      itemMapCache = {};
      for (const [id, item] of Object.entries(d.data)) itemMapCache[item.name] = id;
      return itemMapCache;
    })
    .catch(() => (itemMapCache = {}));
  return itemMapPromise;
}

export function useLolItemMap(): Record<string, string> | null {
  const [map, setMap] = useState(itemMapCache);
  useEffect(() => {
    if (!itemMapCache) loadItemMap().then(setMap);
  }, []);
  return map;
}

export function lolItemIcon(name: string, map: Record<string, string> | null): string | null {
  const id = map?.[name];
  return id ? `${CDN}/${DDRAGON_VER}/img/item/${id}.png` : null;
}
