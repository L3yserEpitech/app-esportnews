import { afterEach, describe, expect, it } from 'vitest';
import { formatCalendarDate, todayCalendarDay } from './calendarDate';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => { process.env.TZ = ORIGINAL_TZ; });

const SHORT = { day: '2-digit', month: 'short', year: 'numeric' } as const;

describe('dates sans fuseau de Liquipedia', () => {
  for (const zone of ['UTC', 'Europe/Helsinki', 'Asia/Tokyo', 'America/Los_Angeles']) {
    it(`garde le jour écrit, à ${zone}`, () => {
      process.env.TZ = zone;

      expect(formatCalendarDate('2018-10-08 00:00:00', SHORT)).toBe('08 oct. 2018');
      expect(formatCalendarDate('2018-10-01 23:30:00', SHORT)).toBe('01 oct. 2018');
      expect(formatCalendarDate('2018-01-01', { year: 'numeric' })).toBe('2018');
      expect(formatCalendarDate('2026-11-01T00:00:00Z', SHORT)).toBe('01 nov. 2026');
    });
  }

  it('ne rend rien pour une date illisible', () => {
    expect(formatCalendarDate('', SHORT)).toBe('');
    expect(formatCalendarDate('bientôt', SHORT)).toBe('');
    expect(formatCalendarDate(null, SHORT)).toBe('');
  });
});

// The backend reckons tournaments in UTC days: a tournament over on the 1st is
// "finished" from 00:00 UTC on the 2nd, whatever the visitor's clock says.
describe('jour courant des tournois', () => {
  for (const zone of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
    it(`reste le jour UTC à ${zone}`, () => {
      process.env.TZ = zone;
      expect(todayCalendarDay(new Date('2026-11-02T01:00:00Z'))).toBe('2026-11-02');
      expect(todayCalendarDay(new Date('2026-11-01T23:00:00Z'))).toBe('2026-11-01');
    });
  }
});
