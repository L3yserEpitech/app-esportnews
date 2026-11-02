import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TournamentHeader from './TournamentHeader';

let dark = true;
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('../../../hooks/useIsDarkTheme', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useIsDarkTheme: () => dark,
}));

const tournament = { id: 1, name: 'Cup', banner_url: 'https://x/light.png', banner_dark_url: 'https://x/dark.png' } as never;
const html = () => renderToStaticMarkup(createElement(TournamentHeader, { tournament } as never));

describe('bannière de tournoi', () => {
  it('prend la version sombre en thème sombre', () => {
    dark = true;
    expect(html()).toContain('https://x/dark.png');
  });

  it('prend la version claire en thème clair', () => {
    dark = false;
    expect(html()).toContain('https://x/light.png');
  });
});
