import { describe, expect, it } from 'vitest';
import { withoutQuery } from './pageViewUrl';

describe('withoutQuery', () => {
  it('drops what a form sent before hydration left in the address', () => {
    expect(withoutQuery('https://www.esportnews.fr/auth/login?email=a%40b.c&password=secret')).toBe(
      'https://www.esportnews.fr/auth/login',
    );
  });

  it('drops a reset token and a fragment', () => {
    expect(withoutQuery('/auth/reset-password?token=abc')).toBe('/auth/reset-password');
    expect(withoutQuery('/article/x#section')).toBe('/article/x');
  });

  it('leaves the rest alone', () => {
    expect(withoutQuery('/cs/match/a-vs-b')).toBe('/cs/match/a-vs-b');
    expect(withoutQuery('')).toBe('');
  });
});
