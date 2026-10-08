import { describe, expect, it } from 'vitest';
import { modifiedDate, toIsoSeconds } from './seoDates';

describe('toIsoSeconds', () => {
  it('drops backend microseconds and keeps an explicit offset', () => {
    expect(toIsoSeconds('2026-10-08T12:16:53.614776Z')).toBe('2026-10-08T12:16:53+00:00');
  });

  it('rejects empty, invalid and zero dates', () => {
    expect(toIsoSeconds('')).toBeUndefined();
    expect(toIsoSeconds('nope')).toBeUndefined();
    expect(toIsoSeconds('0001-01-01T00:00:00Z')).toBeUndefined();
  });
});

describe('modifiedDate', () => {
  const created = '2026-10-01T10:00:00.000000Z';

  it('uses updated_at when it is later than created_at', () => {
    expect(modifiedDate(created, '2026-10-05T08:00:00Z')).toBe('2026-10-05T08:00:00Z');
  });

  it('falls back to created_at when updated_at is missing, zero or earlier', () => {
    expect(modifiedDate(created, undefined)).toBe(created);
    expect(modifiedDate(created, '0001-01-01T00:00:00Z')).toBe(created);
    expect(modifiedDate(created, '2026-09-01T00:00:00Z')).toBe(created);
  });
});
