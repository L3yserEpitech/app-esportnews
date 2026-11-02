import { describe, expect, it } from 'vitest';
import LegacyResultatsRedirect from './page';

describe('/equipe/<x>/resultats legacy', () => {
  it('ne double pas l\'encodage du template', async () => {
    const error = await LegacyResultatsRedirect({
      params: Promise.resolve({ id: 'team%20vitality' }),
      searchParams: Promise.resolve({ wiki: 'counterstrike' }),
    }).catch((e) => e);

    expect(error.digest).toContain('/cs/equipe/team%20vitality/resultats;308');
  });
});
