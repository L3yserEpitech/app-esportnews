import { describe, it, expect } from 'vitest';
import {
  matchHref,
  matchIdFromSegment,
  matchTitleFromSegment,
  tournamentTitleFromSegment,
  matchSegment,
  tournamentHref,
  placementHref,
  tournamentIdFromSegment,
  tournamentSegment,
  teamHref,
  playerHref,
} from './gameLinks';

const vs = (home: string, away: string) => [{ opponent: { name: home } }, { opponent: { name: away } }];

describe('matchHref', () => {
  it('construit /<slug>/match/<match2id> (game-first) quand le wiki est connu', () => {
    expect(matchHref({ wiki: 'counterstrike', match2id: 'ABC_001', id: 42 }))
      .toBe('/cs/match/ABC_001');
  });

  it('préfère match2id à id', () => {
    expect(matchHref({ wiki: 'valorant', match2id: 'X1', id: 99 }))
      .toBe('/valorant/match/X1');
  });

  it('tombe sur id quand match2id est absent', () => {
    expect(matchHref({ wiki: 'valorant', id: 99 })).toBe('/valorant/match/99');
  });

  it('fallback legacy /match/<id> quand le wiki est inconnu/absent', () => {
    expect(matchHref({ id: 7 })).toBe('/match/7');
    expect(matchHref({ wiki: 'unknownwiki', id: 7 })).toBe('/match/7');
  });
});

describe('matchHref avec titre', () => {
  it('préfixe le match2id par les deux équipes', () => {
    expect(matchHref({ wiki: 'counterstrike', match2id: '71Kxd1YC9K_0004', id: 376992, opponents: vs('DONSTU Esports', 'Misa Esports') }))
      .toBe('/cs/match/donstu-esports-vs-misa-esports-71Kxd1YC9K_0004');
  });

  it('translittère les lettres que la décomposition Unicode ne couvre pas', () => {
    expect(matchHref({ wiki: 'leagueoflegends', match2id: 'dfuZ0CbS5V_R01-M010', id: 112949, opponents: vs('Về Đích', 'Fish Market') }))
      .toBe('/lol/match/ve-dich-vs-fish-market-dfuZ0CbS5V_R01-M010');
  });

  it('garde le match2id seul quand une équipe n\'a aucun caractère latin', () => {
    expect(matchSegment({ match2id: 'ABCDEFGHIJ_0001', id: 1, opponents: vs('无敌霸王龙', '1') })).toBe('ABCDEFGHIJ_0001');
  });

  it('garde le match2id seul quand une équipe n\'est pas encore connue', () => {
    expect(matchSegment({ match2id: 'ABCDEFGHIJ_0001', id: 1, opponents: vs('Team Liquid', 'TBD') })).toBe('ABCDEFGHIJ_0001');
    expect(matchSegment({ match2id: 'ABCDEFGHIJ_0001', id: 1, opponents: [{ opponent: { name: 'Team Liquid' } }] })).toBe('ABCDEFGHIJ_0001');
    expect(matchSegment({ match2id: 'ABCDEFGHIJ_0001', id: 1 })).toBe('ABCDEFGHIJ_0001');
  });

  it('coupe les noms trop longs sur une fin de mot, sans perdre la seconde équipe', () => {
    expect(matchSegment({
      match2id: 'AZFALL26GB_0006',
      id: 1,
      opponents: vs('California State Polytechnic University, Pomona Green', 'California State University, Northridge Red'),
    })).toBe('california-state-polytechnic-vs-california-state-university-AZFALL26GB_0006');
  });

  it('ne préfixe jamais un id qu\'on ne saurait pas relire', () => {
    expect(matchSegment({ match2id: 'ABC_001', id: 1, opponents: vs('A', 'B') })).toBe('ABC_001');
    expect(matchSegment({ id: 99, opponents: vs('A', 'B') })).toBe('99');
  });

  it('fallback legacy sans titre quand le wiki est inconnu', () => {
    expect(matchHref({ match2id: 'ABCDEFGHIJ_0001', id: 1, opponents: vs('A', 'B') })).toBe('/match/ABCDEFGHIJ_0001');
  });
});

describe('matchIdFromSegment', () => {
  it('extrait un match2id préfixé', () => {
    expect(matchIdFromSegment('donstu-esports-vs-misa-esports-71Kxd1YC9K_0004')).toBe('71Kxd1YC9K_0004');
  });

  it('ne coupe pas un match2id qui contient un tiret', () => {
    expect(matchIdFromSegment('ve-dich-vs-fish-market-dfuZ0CbS5V_R01-M010')).toBe('dfuZ0CbS5V_R01-M010');
  });

  it('rend tel quel un match2id nu ou un ancien id numérique', () => {
    expect(matchIdFromSegment('dfuZ0CbS5V_R01-M010')).toBe('dfuZ0CbS5V_R01-M010');
    expect(matchIdFromSegment('376992')).toBe('376992');
  });

  it('relit ce que matchSegment produit, équipes numériques comprises', () => {
    const match = { match2id: 'LCKAS26S2P_R02-M001', id: 1, opponents: vs('100 Thieves', 'T1') };
    expect(matchIdFromSegment(matchSegment(match))).toBe('LCKAS26S2P_R02-M001');
  });
});

describe('tournamentHref avec titre', () => {
  it('préfixe le pageid par le nom du tournoi', () => {
    expect(tournamentHref({ wiki: 'counterstrike', id: 377513, name: 'BLAST Frequent Flyers Program 2026' }))
      .toBe('/cs/tournois/blast-frequent-flyers-program-2026-377513');
  });

  it('retire accents et ponctuation', () => {
    expect(tournamentSegment({ id: 12, name: 'Magyar Nemzeti E-sport Bajnokság: Season 8 - Super Cup' }))
      .toBe('magyar-nemzeti-e-sport-bajnoksag-season-8-super-cup-12');
    expect(tournamentSegment({ id: 12, name: 'Papy’Versary 2026' })).toBe('papy-versary-2026-12');
  });

  it('coupe un nom trop long sur une fin de mot', () => {
    expect(tournamentSegment({ id: 12, name: 'RLCS Club Championship 2027 - Club League: Middle East and North Africa Qualifier' }))
      .toBe('rlcs-club-championship-2027-club-league-middle-east-and-12');
  });

  it('garde l\'id seul sans nom latin', () => {
    expect(tournamentSegment({ id: 12, name: '无敌杯' })).toBe('12');
    expect(tournamentSegment({ id: 12 })).toBe('12');
  });

  it('laisse un pagename encodé sans lui ajouter de titre', () => {
    expect(tournamentHref({ wiki: 'counterstrike', id: 'CCT/2026/Europe/Series_5', name: 'CCT' }))
      .toBe('/cs/tournois/CCT%2F2026%2FEurope%2FSeries_5');
  });

  it('fallback legacy sans titre quand le wiki est inconnu', () => {
    expect(tournamentHref({ id: 5, name: 'Foo Cup' })).toBe('/tournois/5');
  });
});

describe('tournamentIdFromSegment', () => {
  it('extrait le pageid final, même si le nom finit par une année', () => {
    expect(tournamentIdFromSegment('blast-frequent-flyers-program-2026-377513')).toBe('377513');
  });

  it('rend tel quel un pageid nu', () => {
    expect(tournamentIdFromSegment('377513')).toBe('377513');
  });

  it('ne confond pas un pagename ou un ancien slug avec le nouveau format', () => {
    expect(tournamentIdFromSegment('BLAST/Premier/2026/Frequent_Flyers')).toBe('BLAST/Premier/2026/Frequent_Flyers');
    expect(tournamentIdFromSegment('Ireland_Collegiate/2026-27/Winter')).toBe('Ireland_Collegiate/2026-27/Winter');
    expect(tournamentIdFromSegment('blast_bounty_2026_summer')).toBe('blast_bounty_2026_summer');
  });
});

describe('tournamentHref', () => {
  it('construit /<slug>/tournois/<id> (game-first) quand le wiki est connu', () => {
    expect(tournamentHref({ wiki: 'rainbowsix', id: 123 }))
      .toBe('/r6/tournois/123');
  });

  it('fallback legacy /tournois/<id> quand le wiki est inconnu/absent', () => {
    expect(tournamentHref({ id: 5 })).toBe('/tournois/5');
  });
});

describe('teamHref', () => {
  it('construit /<slug>/equipe/<template> + query prefill', () => {
    expect(teamHref({ wiki: 'counterstrike', template: 'team vitality 2023', name: 'Team Vitality' }))
      .toBe('/cs/equipe/team%20vitality%202023?name=Team+Vitality');
  });

  it('utilise id quand template absent', () => {
    expect(teamHref({ wiki: 'valorant', id: 42 })).toBe('/valorant/equipe/42');
  });

  it('fallback legacy /equipe/<id> + garde wiki en query', () => {
    expect(teamHref({ wiki: 'unknownwiki', template: 'x', name: 'X' }))
      .toBe('/equipe/x?wiki=unknownwiki&name=X');
  });
});

describe('playerHref', () => {
  it('construit /<slug>/joueur/<pagename>', () => {
    expect(playerHref({ wiki: 'counterstrike', pagename: 'ZywOo' })).toBe('/cs/joueur/ZywOo');
  });

  it('fallback legacy /joueur/<pagename> si wiki inconnu', () => {
    expect(playerHref({ pagename: 'Faker' })).toBe('/joueur/Faker');
  });
});

describe('placementHref', () => {
  const placement = { tournament: 'PGL Masters Bucharest 2026', tournament_id: 362800, tournament_page: 'PGL/2026/Masters' };

  it('lie directement l\'URL canonique du tournoi', () => {
    expect(placementHref('counterstrike', placement)).toBe('/cs/tournois/pgl-masters-bucharest-2026-362800');
  });

  it('retombe sur le pagename sans tournament_id', () => {
    expect(placementHref('counterstrike', { ...placement, tournament_id: undefined })).toBe('/cs/tournois/PGL%2F2026%2FMasters');
  });

  it('ne lie rien quand la page n\'a pas de tournoi', () => {
    expect(placementHref('counterstrike', { ...placement, tournament_missing: true })).toBeNull();
  });
});

describe('titres lus dans le segment', () => {
  it('lit les équipes d\'un segment de match', () => {
    expect(matchTitleFromSegment('vendetta-vs-lyon-AMERS2NHPL_R04-M001')).toBe('Vendetta vs Lyon');
  });

  it('n\'invente rien sur un id de match nu', () => {
    expect(matchTitleFromSegment('AMERS2NHPL_R04-M001')).toBeNull();
  });

  it('lit le nom d\'un segment de tournoi', () => {
    expect(tournamentTitleFromSegment('blast-frequent-flyers-program-2026-377513')).toBe('Blast Frequent Flyers Program 2026');
  });

  it('n\'invente rien sur un id de tournoi nu ou un pagename', () => {
    expect(tournamentTitleFromSegment('377513')).toBeNull();
    expect(tournamentTitleFromSegment('Project_Blender/2025/Phase_4')).toBeNull();
  });
});
