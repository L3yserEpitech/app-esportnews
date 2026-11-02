import { describe, expect, it } from 'vitest';
import SignInPage from './page';

// next-auth has no route here: the old form sent people to /api/auth/error.
describe('/auth/signin', () => {
  it('renvoie vers la vraie page de connexion', () => {
    let thrown: { digest?: string } | undefined;
    try {
      SignInPage();
    } catch (error) {
      thrown = error as { digest?: string };
    }
    expect(thrown?.digest).toContain('/auth/login;308');
  });
});
