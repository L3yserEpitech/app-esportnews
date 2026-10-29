import { describe, it, expect } from 'vitest';
import {
  brandTitle,
  frenchDate,
  frenchDateRange,
  frenchTime,
  gameTitle,
  matchDescription,
  matchTitle,
  streamPlatform,
  tournamentDescription,
  tournamentTitle,
} from './seoTitles';

describe('brandTitle', () => {
  it('ajoute la marque quand le titre reste sous 60 caractères', () => {
    expect(brandTitle('Matchs esport en direct')).toBe('Matchs esport en direct | Esport News');
  });

  it('garde le titre nu quand la marque le ferait dépasser 60 caractères', () => {
    const title = 'Un titre éditorial déjà long de 47 caractères !';
    expect(title).toHaveLength(47);
    expect(brandTitle(title)).toBe(title);
  });

  it('accepte exactement 60 caractères avec la marque', () => {
    const title = 'a'.repeat(46);
    expect(brandTitle(title)).toHaveLength(60);
  });
});

describe('dates en français, fuseau Europe/Paris', () => {
  it('formate une date longue', () => {
    expect(frenchDate('2026-10-28T17:00:00Z')).toBe('28 octobre 2026');
  });

  it('bascule au jour suivant quand Paris est déjà le lendemain', () => {
    expect(frenchDate('2026-10-28T23:30:00Z')).toBe('29 octobre 2026');
  });

  it('formate une heure en 18h00', () => {
    expect(frenchTime('2026-10-28T17:00:00Z')).toBe('18h00');
  });

  it('fusionne une plage dans le même mois', () => {
    expect(frenchDateRange('2026-11-03T10:00:00Z', '2026-11-12T20:00:00Z')).toBe('du 3 au 12 novembre 2026');
  });

  it('écrit les deux dates complètes quand le mois change', () => {
    expect(frenchDateRange('2026-10-28T10:00:00Z', '2026-11-02T20:00:00Z')).toBe('du 28 octobre au 2 novembre 2026');
  });

  it('écrit les deux années quand elles diffèrent', () => {
    expect(frenchDateRange('2026-12-28T10:00:00Z', '2027-01-04T20:00:00Z')).toBe('du 28 décembre 2026 au 4 janvier 2027');
  });

  it('retombe sur un seul jour sans fin ou sur le même jour', () => {
    expect(frenchDateRange('2026-11-03T10:00:00Z', null)).toBe('le 3 novembre 2026');
    expect(frenchDateRange('2026-11-03T10:00:00Z', '2026-11-03T22:00:00Z')).toBe('le 3 novembre 2026');
  });

  it('rend une chaîne vide sans date valide', () => {
    expect(frenchDate(null)).toBe('');
    expect(frenchDate('pas une date')).toBe('');
    expect(frenchDateRange(null, null)).toBe('');
  });
});

describe('matchTitle', () => {
  const match = {
    home: 'Fnatic',
    away: 'BIG',
    tournament: 'Stake Ranked Ep. 5',
    game: 'CS2',
    beginAt: '2026-10-28T17:00:00Z',
  };

  it('équipes, tournoi, jeu et date quand tout tient en 60 caractères', () => {
    expect(matchTitle(match)).toBe('Fnatic vs BIG – Stake Ranked Ep. 5, CS2, 28 octobre 2026');
  });

  it('sacrifie le tournoi avant le jeu et la date', () => {
    const title = matchTitle({ ...match, tournament: 'Esports World Cup 2026 Counter-Strike Championship' });
    expect(title).toBe('Fnatic vs BIG – CS2, 28 octobre 2026');
  });

  it('retombe sur les équipes seules quand même le jeu ne tient pas', () => {
    const title = matchTitle({ ...match, home: 'Une équipe au nom particulièrement interminable', away: 'Une autre équipe tout aussi longue' });
    expect(title).toBe('Une équipe au nom particulièrement interminable vs Une autre équipe tout aussi longue');
  });

  it('remplace un adversaire inconnu par TBD et omet ce qui manque', () => {
    expect(matchTitle({ home: 'Fnatic', away: null, tournament: null, game: 'CS2', beginAt: null })).toBe('Fnatic vs TBD – CS2');
  });
});

describe('streamPlatform', () => {
  it('reconnaît Twitch, YouTube et Kick', () => {
    expect(streamPlatform('https://www.twitch.tv/esl_csgo')).toBe('Twitch');
    expect(streamPlatform('https://youtube.com/watch?v=x')).toBe('YouTube');
    expect(streamPlatform('https://kick.com/x')).toBe('Kick');
  });

  it('rend le domaine nu sinon, et rien sans URL', () => {
    expect(streamPlatform('https://www.afreecatv.com/x')).toBe('afreecatv.com');
    expect(streamPlatform(null)).toBe('');
    expect(streamPlatform('pas une url')).toBe('');
  });
});

describe('matchDescription', () => {
  const match = {
    home: 'Fnatic',
    away: 'BIG',
    tournament: 'Stake Ranked Ep. 5',
    stage: 'Playoffs',
    game: 'CS2',
    beginAt: '2026-10-28T17:00:00Z',
    bestOf: 3,
    streamUrl: 'https://www.twitch.tv/esl_csgo',
  };

  it('tournoi, phase, format, horaire, jeu et stream', () => {
    expect(matchDescription(match)).toBe(
      'Fnatic vs BIG : Stake Ranked Ep. 5, Playoffs. BO3 le 28 octobre 2026 à 18h00, CS2. Stream sur Twitch. Score, résultat et stats en direct.',
    );
  });

  it('reste sous 160 caractères en lâchant la fin puis le stream', () => {
    const description = matchDescription({
      ...match,
      tournament: 'Esports World Cup 2026 Counter-Strike 2 Championship Finals',
      stage: 'Grand Final Upper Bracket',
    });
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain('Stream sur Twitch.');
    expect(description).not.toContain('Score, résultat');
  });

  it('omet proprement les champs absents', () => {
    expect(matchDescription({ home: 'Fnatic', away: 'BIG', tournament: 'IEM', game: 'CS2' })).toBe(
      'Fnatic vs BIG : IEM, CS2. Score, résultat et stats en direct.',
    );
  });

  it('ignore la section « Results », qui nomme une liste plate et non une phase', () => {
    expect(matchDescription({ home: 'Fnatic', away: 'BIG', tournament: 'IEM', stage: 'Results', game: 'CS2' })).toBe(
      'Fnatic vs BIG : IEM, CS2. Score, résultat et stats en direct.',
    );
  });
});

describe('tournamentTitle', () => {
  it('ajoute le jeu quand la place le permet', () => {
    expect(tournamentTitle({ name: 'IEM Cologne 2026', game: 'CS2' })).toBe('IEM Cologne 2026 – Tournoi CS2');
  });

  it('garde le nom seul quand le jeu ferait dépasser 60 caractères', () => {
    const name = 'Esports World Cup 2026 Counter-Strike 2 Championship Finals';
    expect(tournamentTitle({ name, game: 'CS2' })).toBe(name);
  });
});

describe('tournamentDescription', () => {
  it('nom, jeu, dates, équipes et prize pool', () => {
    expect(
      tournamentDescription({
        name: 'IEM Cologne 2026',
        game: 'CS2',
        beginAt: '2026-11-03T10:00:00Z',
        endAt: '2026-11-12T20:00:00Z',
        teams: 16,
        prizepool: '$1,250,000',
      }),
    ).toBe(
      'IEM Cologne 2026, tournoi CS2 du 3 au 12 novembre 2026 : 16 équipes, $1,250,000 de prize pool. Matchs, résultats et bracket en direct.',
    );
  });

  it('lâche le prize pool puis les équipes pour tenir en 160', () => {
    const description = tournamentDescription({
      name: 'Esports World Cup 2026 Counter-Strike 2 Championship',
      game: 'Counter-Strike 2',
      beginAt: '2026-11-03T10:00:00Z',
      endAt: '2026-12-12T20:00:00Z',
      teams: 16,
      prizepool: '$1,250,000',
    });
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).not.toContain('prize pool');
  });

  it('omet ce qui manque', () => {
    expect(tournamentDescription({ name: 'IEM Cologne 2026', game: null })).toBe(
      'IEM Cologne 2026 : matchs, résultats et bracket en direct.',
    );
  });
});

describe('gameTitle', () => {
  it('nom du jeu puis promesse, sous 60 caractères', () => {
    expect(gameTitle('Counter-Strike 2')).toBe('Counter-Strike 2 : matchs en direct, tournois et actus');
  });

  it('raccourcit la promesse pour un nom long', () => {
    expect(gameTitle('Mobile Legends: Bang Bang')).toBe('Mobile Legends: Bang Bang : matchs, tournois et actus');
  });
});
