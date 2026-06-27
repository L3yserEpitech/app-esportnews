export interface ExternalLink { key: string; label: string; url: string; }

const LABELS: Record<string, string> = {
  dotabuff: 'Dotabuff', stratz: 'STRATZ', datdota: 'DatDota',
  opgg: 'OP.GG', 'op.gg': 'OP.GG',
  hltv: 'HLTV', vlr: 'VLR.gg', faceit: 'FACEIT',
};

export function buildExternalLinks(links: Record<string, string> | undefined): ExternalLink[] {
  if (!links) return [];
  return Object.entries(links)
    .filter(([, url]) => typeof url === 'string' && url.startsWith('http'))
    .map(([key, url]) => ({ key, label: LABELS[key] ?? key, url }));
}
