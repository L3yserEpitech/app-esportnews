// Static mapping of Valorant map names → valorant-api.com UUIDs.
// Assets are served straight from media.valorant-api.com (CDN, no CORS).
// New maps ship ~twice a year: add the UUID from https://valorant-api.com/v1/maps.

const MAP_UUIDS: Record<string, string> = {
  abyss: '224b0a95-48b9-f703-1bd8-67aca101a61f',
  ascent: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319',
  bind: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba',
  breeze: '2fb9a4fd-47b8-4e7d-a969-74b4046ebd53',
  corrode: '1c18ab1f-420d-0d8b-71d0-77ad3c439115',
  fracture: 'b529448b-4d60-346e-e89e-00a4c527a405',
  haven: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047',
  icebox: 'e2ad5c54-4114-a870-9641-8ea21279579a',
  lotus: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9',
  pearl: 'fd267378-4d1d-484f-ff52-77821ed10dc2',
  split: 'd960549e-485c-e861-8d71-aa9d1aed12a2',
  summit: '756da597-416b-c0f2-f47b-afbdf28670bc',
  sunset: '92584fbe-486a-b1b2-9faa-39b0f486b498',
};

/** Wide splash art for a Valorant map, or null when the name is unknown. */
export function valorantMapSplash(mapName: string | undefined | null): string | null {
  if (!mapName) return null;
  const uuid = MAP_UUIDS[mapName.trim().toLowerCase()];
  return uuid ? `https://media.valorant-api.com/maps/${uuid}/splash.png` : null;
}
