import { describe, expect, it } from 'vitest';
import { age, since } from './time';

const now = new Date('2026-11-25T12:00:00Z').getTime();
const ago = (ms: number) => new Date(now - ms).toISOString();
const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;

describe('since', () => {
  it('counts in seconds, minutes, hours then days, like the backend', () => {
    expect(since(ago(200), now)).toBe("à l'instant");
    expect(since(ago(40 * S), now)).toBe('il y a 40 s');
    expect(since(ago(12 * MIN + 50 * S), now)).toBe('il y a 12 min');
    expect(since(ago(3 * H), now)).toBe('il y a 3 h');
    expect(since(ago(47 * H), now)).toBe('il y a 47 h');
    expect(since(ago(9 * 24 * H), now)).toBe('il y a 9 j');
  });

  it('shows a dash for a list never refreshed or an unreadable date', () => {
    expect(since(null, now)).toBe('—');
    expect(since(undefined, now)).toBe('—');
    expect(since('not a date', now)).toBe('—');
  });

  it('does not go negative when the server clock is slightly ahead', () => {
    expect(since(ago(-5 * S), now)).toBe("à l'instant");
  });
});

describe('age', () => {
  it('is in minutes up to two hours, then in hours', () => {
    expect(age(ago(22 * MIN), now)).toBe('22 min');
    expect(age(ago(119 * MIN), now)).toBe('119 min');
    expect(age(ago(3 * H + 10 * MIN), now)).toBe('3 h');
    expect(age(ago(-5 * S), now)).toBe('0 min');
  });
});
