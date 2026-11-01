import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TournamentHeader from './TournamentHeader';
import TournamentCard from '../../../components/tournaments/TournamentCard';
import type { PandaTournament } from '../../../types';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const tournament = {
  id: 16019,
  name: 'FC Basel - Cash Cup #4',
  wiki: 'easportsfc',
  videogame: { id: 22, name: 'EA Sports FC', slug: 'easportsfc' },
} as unknown as PandaTournament;

describe('badge du jeu', () => {
  it('affiche le nom du jeu sur la page tournoi, pas son slug', () => {
    const html = renderToStaticMarkup(createElement(TournamentHeader, { tournament } as never));

    expect(html).toContain('EA Sports FC');
    expect(html).not.toContain('easportsfc');
  });

  it('affiche le nom du jeu sur la carte tournoi, pas son slug', () => {
    const html = renderToStaticMarkup(createElement(TournamentCard, { tournament, showGameBadge: true }));

    expect(html).toContain('EA Sports FC');
    expect(html).not.toContain('EASPORTSFC');
  });
});
