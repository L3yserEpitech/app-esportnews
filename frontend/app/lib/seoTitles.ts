// Title and description templates for the entity pages. Google shows the site
// name on its own line, so the brand suffix only earns its place when the title
// has room for it; everything else degrades by dropping the least useful part
// rather than truncating mid-word.

export const SITE_NAME = 'Esport News';
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

const BRAND_SUFFIX = ` | ${SITE_NAME}`;
const PARIS = 'Europe/Paris';

export function brandTitle(title: string): string {
  const branded = `${title}${BRAND_SUFFIX}`;
  return branded.length <= TITLE_MAX ? branded : title;
}

function firstFitting(candidates: string[], max: number): string {
  return candidates.find((candidate) => candidate.length <= max) ?? candidates[candidates.length - 1];
}

function joinPresent(parts: Array<string | number | null | undefined>, separator: string): string {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').join(separator);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function datePart(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('fr-FR', { ...options, timeZone: PARIS });
}

export function frenchDate(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? datePart(date, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export function frenchTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '';
  return date
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: PARIS })
    .replace(':', 'h');
}

export function frenchDateRange(begin: string | null | undefined, end: string | null | undefined): string {
  const from = parseDate(begin);
  if (!from) return '';
  const to = parseDate(end);
  const split = (date: Date) => ({
    day: datePart(date, { day: 'numeric' }),
    month: datePart(date, { month: 'long' }),
    year: datePart(date, { year: 'numeric' }),
  });
  const a = split(from);
  const b = to ? split(to) : a;
  if (a.day === b.day && a.month === b.month && a.year === b.year) return `le ${frenchDate(begin)}`;
  if (a.year !== b.year) return `du ${a.day} ${a.month} ${a.year} au ${b.day} ${b.month} ${b.year}`;
  if (a.month !== b.month) return `du ${a.day} ${a.month} au ${b.day} ${b.month} ${b.year}`;
  return `du ${a.day} au ${b.day} ${b.month} ${b.year}`;
}

export interface MatchSeoInput {
  home?: string | null;
  away?: string | null;
  tournament?: string | null;
  game?: string | null;
  beginAt?: string | null;
}

function versus(match: MatchSeoInput): string {
  return `${match.home || 'TBD'} vs ${match.away || 'TBD'}`;
}

export function matchTitle(match: MatchSeoInput): string {
  const teams = versus(match);
  const date = frenchDate(match.beginAt);
  const tails = [
    joinPresent([match.tournament, match.game, date], ', '),
    joinPresent([match.tournament, match.game], ', '),
    joinPresent([match.game, date], ', '),
    joinPresent([match.game], ', '),
    '',
  ];
  return firstFitting(
    tails.map((tail) => (tail ? `${teams} – ${tail}` : teams)),
    TITLE_MAX,
  );
}

const STREAM_PLATFORMS: Array<[RegExp, string]> = [
  [/(^|\.)twitch\.tv$/, 'Twitch'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'],
  [/(^|\.)kick\.com$/, 'Kick'],
];

export function streamPlatform(url: string | null | undefined): string {
  if (!url) return '';
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
  return STREAM_PLATFORMS.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

export interface MatchDescriptionInput extends MatchSeoInput {
  stage?: string | null;
  bestOf?: number | null;
  streamUrl?: string | null;
}

// Sentences are dropped from the end until the text fits: the generic closing
// line goes first, the stream mention second, the facts never.
function fitSentences(required: string[], optional: string[], max: number): string {
  const kept = [...optional];
  let text = [...required, ...kept].join(' ');
  while (text.length > max && kept.length) {
    kept.pop();
    text = [...required, ...kept].join(' ');
  }
  return text;
}

// Liquipedia files matches of a flat list under a section literally named
// "Results": that is a page heading, not a stage of the competition.
function stageName(stage: string | null | undefined): string | null {
  return stage && stage.trim().toLowerCase() !== 'results' ? stage : null;
}

export function matchDescription(match: MatchDescriptionInput): string {
  const teams = versus(match);
  const date = frenchDate(match.beginAt);
  const time = frenchTime(match.beginAt);
  const format = match.bestOf ? `BO${match.bestOf}` : '';
  const when = date ? joinPresent([format, `le ${date}${time ? ` à ${time}` : ''}`], ' ') : format;
  const context = joinPresent([match.tournament, stageName(match.stage), when ? null : match.game], ', ');
  const platform = streamPlatform(match.streamUrl);

  const required = [
    context ? `${teams} : ${context}.` : `${teams}.`,
    ...(when ? [`${joinPresent([when, match.game], ', ')}.`] : []),
  ];
  const optional = [
    ...(platform ? [`Stream sur ${platform}.`] : []),
    'Score, résultat et stats en direct.',
  ];
  return fitSentences(required, optional, DESCRIPTION_MAX);
}

export interface TournamentSeoInput {
  name: string;
  game?: string | null;
  beginAt?: string | null;
  endAt?: string | null;
  teams?: number | null;
  prizepool?: string | null;
}

export function tournamentTitle({ name, game }: Pick<TournamentSeoInput, 'name' | 'game'>): string {
  return firstFitting(game ? [`${name} – Tournoi ${game}`, name] : [name], TITLE_MAX);
}

export function tournamentDescription(tournament: TournamentSeoInput): string {
  const head = joinPresent(
    [tournament.game ? `${tournament.name}, tournoi ${tournament.game}` : tournament.name, frenchDateRange(tournament.beginAt, tournament.endAt)],
    ' ',
  );
  const facts = [
    tournament.teams ? `${tournament.teams} équipes` : '',
    tournament.prizepool ? `${tournament.prizepool} de prize pool` : '',
  ];
  const closing = 'Matchs, résultats et bracket en direct.';
  const candidates = [facts, facts.slice(0, 1), []].map((kept) => {
    const present = kept.filter(Boolean);
    return present.length
      ? `${head} : ${present.join(', ')}. ${closing}`
      : `${head} : ${closing.charAt(0).toLowerCase()}${closing.slice(1)}`;
  });
  return firstFitting(candidates, DESCRIPTION_MAX);
}

export function gameTitle(name: string): string {
  return firstFitting(
    [`${name} : matchs en direct, tournois et actus`, `${name} : matchs, tournois et actus`, `Esport ${name}`],
    TITLE_MAX,
  );
}
