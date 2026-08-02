import { describe, it, expect } from 'vitest';
import { buildBracketLayout, columnX, CELL_H, CELL_W, SLOT, type BracketLayout } from './bracketModel';
import type { PandaMatch, PandaBracketData } from '../../types';

/** Edges landing on a given column, in emission order. */
function edgesInto(layout: BracketLayout, column: number) {
  return layout.edges.filter(e => e.toX === columnX(column));
}

// Fixtures mirror real Liquipedia payloads:
//  - CCT/2026/Europe/Series_5 (counterstrike): Swiss rounds (matchlist) + a
//    16-team single-elimination playoff bracket, all under one `Playoffs` section.
//  - Esports_World_Cup/2026/Western_Europe (dota2): double elimination, where
//    matchIndexInRound is numbered across the upper and lower sections.

function match(id: string, bracketId: string, bracket_data: PandaBracketData): PandaMatch {
  return { id: 0, name: id, match2id: id, match2bracketid: bracketId, bracket_data } as unknown as PandaMatch;
}

function treeNode(
  id: string,
  bracketId: string,
  roundIndex: number,
  matchIndexInRound: number,
  lower: string[],
  opts: { roundCount?: number; sectionCount?: number; section?: string } = {},
): PandaMatch {
  return match(id, bracketId, {
    type: 'bracket',
    bracket_index: 9,
    bracket_section: opts.section ?? 'upper',
    lower_match_ids: lower,
    coordinates: {
      round_index: roundIndex,
      match_index_in_round: matchIndexInRound,
      round_count: opts.roundCount ?? 4,
      section_index: opts.section === 'lower' ? 1 : 0,
      section_count: opts.sectionCount ?? 1,
    },
  });
}

function listNode(id: string, section: string, bracketIndex: number, matchIndex: number): PandaMatch {
  const m = match(id, `list-${bracketIndex}`, {
    type: 'matchlist',
    bracket_index: bracketIndex,
    match_index: matchIndex,
  });
  return { ...m, section } as PandaMatch;
}

/** 8 → 4 → 2 → 1, exactly the CCT playoff shape. */
function singleElim16(): PandaMatch[] {
  const out: PandaMatch[] = [];
  for (let i = 0; i < 8; i++) out.push(treeNode(`R01-M00${i + 1}`, 'B', 0, i, []));
  for (let i = 0; i < 4; i++) {
    out.push(treeNode(`R02-M00${i + 1}`, 'B', 1, i, [`R01-M00${2 * i + 1}`, `R01-M00${2 * i + 2}`]));
  }
  for (let i = 0; i < 2; i++) {
    out.push(treeNode(`R03-M00${i + 1}`, 'B', 2, i, [`R02-M00${2 * i + 1}`, `R02-M00${2 * i + 2}`]));
  }
  out.push(treeNode('R04-M001', 'B', 3, 0, ['R03-M001', 'R03-M002']));
  return out;
}

describe('buildBracketLayout — single elimination', () => {
  const layout = buildBracketLayout(singleElim16());

  it('builds one column per round, in bracket order', () => {
    expect(layout.columns.map(c => c.cells.length)).toEqual([8, 4, 2, 1]);
  });

  it('names rounds from the distance to the final', () => {
    expect(layout.columns.map(c => c.label)).toEqual([
      { kind: 'i18n', key: 'bracket_round_of_16' },
      { kind: 'i18n', key: 'bracket_quarterfinals' },
      { kind: 'i18n', key: 'bracket_semifinals' },
      { kind: 'i18n', key: 'bracket_final' },
    ]);
  });

  it('orders cells by matchIndexInRound, not by input order', () => {
    const scrambled = [...singleElim16()].reverse();
    const ids = buildBracketLayout(scrambled).columns[0].cells.map(c => c.match.match2id);
    expect(ids).toEqual([
      'R01-M001', 'R01-M002', 'R01-M003', 'R01-M004',
      'R01-M005', 'R01-M006', 'R01-M007', 'R01-M008',
    ]);
  });

  it('centres a child on the matches that actually feed it', () => {
    const [r1, r2, , r4] = layout.columns;
    expect(r2.cells[0].centerY).toBe((r1.cells[0].centerY + r1.cells[1].centerY) / 2);
    expect(r2.cells[3].centerY).toBe((r1.cells[6].centerY + r1.cells[7].centerY) / 2);
    // The final sits dead centre of the eight opening matches.
    expect(r4.cells[0].centerY).toBe(4 * SLOT);
  });

  it('draws exactly one edge per real parent link', () => {
    expect([0, 1, 2, 3].map(i => edgesInto(layout, i).length)).toEqual([0, 8, 4, 2]);
    const qf = layout.columns[1];
    expect(edgesInto(layout, 1).slice(0, 2)).toEqual([
      { fromX: CELL_W, fromY: layout.columns[0].cells[0].centerY, toX: columnX(1), toY: qf.cells[0].centerY },
      { fromX: CELL_W, fromY: layout.columns[0].cells[1].centerY, toX: columnX(1), toY: qf.cells[0].centerY },
    ]);
  });

  it('never overlaps two cells', () => {
    for (const col of layout.columns) {
      for (let i = 1; i < col.cells.length; i++) {
        expect(col.cells[i].centerY - col.cells[i - 1].centerY).toBeGreaterThanOrEqual(CELL_H);
      }
    }
  });
});

describe('buildBracketLayout — double elimination', () => {
  // Verbatim topology of Esports_World_Cup/2026/Western_Europe.
  const de = [
    treeNode('R01-M001', 'W', 0, 0, [], { sectionCount: 2 }),
    treeNode('R01-M002', 'W', 0, 1, [], { sectionCount: 2 }),
    treeNode('R01-M003', 'W', 0, 2, [], { sectionCount: 2 }),
    treeNode('R01-M004', 'W', 0, 3, [], { sectionCount: 2 }),
    treeNode('R01-M005', 'W', 0, 4, [], { sectionCount: 2, section: 'lower' }),
    treeNode('R01-M006', 'W', 0, 5, [], { sectionCount: 2, section: 'lower' }),
    treeNode('R02-M001', 'W', 1, 0, ['R01-M001', 'R01-M002'], { sectionCount: 2 }),
    treeNode('R02-M002', 'W', 1, 1, ['R01-M003', 'R01-M004'], { sectionCount: 2 }),
    treeNode('R02-M003', 'W', 1, 2, ['R01-M005'], { sectionCount: 2, section: 'lower' }),
    treeNode('R02-M004', 'W', 1, 3, ['R01-M006'], { sectionCount: 2, section: 'lower' }),
    treeNode('R03-M001', 'W', 2, 0, ['R02-M003', 'R02-M004'], { sectionCount: 2, section: 'lower' }),
    treeNode('R04-M001', 'W', 3, 0, ['R02-M001', 'R02-M002'], { sectionCount: 2 }),
    treeNode('R04-M002', 'W', 3, 1, ['R03-M001'], { sectionCount: 2, section: 'lower' }),
  ];
  const layout = buildBracketLayout(de);

  it('keeps upper and lower matches of a round in one column', () => {
    expect(layout.columns.map(c => c.cells.length)).toEqual([6, 4, 1, 2]);
  });

  it('falls back to numeric round names when both sections are present', () => {
    expect(layout.columns[0].label).toEqual({ kind: 'i18n', key: 'bracket_round', round: 1 });
  });

  it('tags each cell with its bracket side', () => {
    expect(layout.columns[0].cells.map(c => c.side)).toEqual([
      'upper', 'upper', 'upper', 'upper', 'lower', 'lower',
    ]);
  });

  it('handles single-parent lower-bracket links', () => {
    const r2 = layout.columns[1];
    expect(r2.cells[2].centerY).toBe(layout.columns[0].cells[4].centerY);
    expect(edgesInto(layout, 1)).toHaveLength(6);
  });

  it('keeps the upper-bracket final connected across the lower-bracket column', () => {
    // Round 4 upper is fed by round 2 upper — two columns to its left.
    const spanning = edgesInto(layout, 3).filter(e => e.fromX === columnX(1) + CELL_W);
    expect(spanning).toHaveLength(2);
    expect(spanning.every(e => e.toY === layout.columns[3].cells[0].centerY)).toBe(true);
    expect(edgesInto(layout, 3)).toHaveLength(3);
  });

  it('never overlaps cells even when averaging collapses positions', () => {
    for (const col of layout.columns) {
      for (let i = 1; i < col.cells.length; i++) {
        expect(col.cells[i].centerY - col.cells[i - 1].centerY).toBeGreaterThanOrEqual(CELL_H);
      }
    }
  });
});

describe('buildBracketLayout — bracket split into one mini-bracket per round', () => {
  // Verbatim topology of BLAST/Bounty/2026/Summer: three separate bracket ids,
  // each reporting round_index 0 / round_count 1 and an empty lowerMatchIds.
  // The real pairing crosses the column — QF0 + QF2 feed SF0 — so anything based
  // on 2j / 2j+1 index arithmetic would build the wrong tree.
  const SPIRIT = 1, LIQUID = 2, MOUZ = 3, DMAX = 4, MONGOLZ = 5, FAZE = 6, ASTRALIS = 7, PAIN = 8;

  function played(id: string, bracketId: string, index: number, a: number, b: number, winner: number): PandaMatch {
    return {
      id: 0,
      match2id: id,
      match2bracketid: bracketId,
      section: 'Results',
      status: 'finished',
      winner_id: winner,
      opponents: [{ id: a, type: 'team', opponent: { id: a, name: `T${a}` } },
                  { id: b, type: 'team', opponent: { id: b, name: `T${b}` } }],
      bracket_data: {
        type: 'bracket',
        bracket_index: bracketId === 'QF' ? 0 : bracketId === 'SF' ? 1 : 2,
        bracket_section: 'upper',
        lower_match_ids: [],
        coordinates: {
          round_index: 0, match_index_in_round: index,
          round_count: 1, section_index: 0, section_count: 1,
        },
      },
    } as unknown as PandaMatch;
  }

  const blast = [
    played('QF-M001', 'QF', 0, SPIRIT, LIQUID, SPIRIT),
    played('QF-M002', 'QF', 1, MOUZ, DMAX, MOUZ),
    played('QF-M003', 'QF', 2, MONGOLZ, FAZE, FAZE),
    played('QF-M004', 'QF', 3, ASTRALIS, PAIN, ASTRALIS),
    played('SF-M001', 'SF', 0, SPIRIT, FAZE, SPIRIT),
    played('SF-M002', 'SF', 1, MOUZ, ASTRALIS, MOUZ),
    played('F-M001', 'F', 0, SPIRIT, MOUZ, MOUZ),
  ];
  const layout = buildBracketLayout(blast);

  it('derives the links from the winners when Liquipedia declares none', () => {
    expect([0, 1, 2].map(i => edgesInto(layout, i).length)).toEqual([0, 4, 2]);
  });

  it('links across the column, not by 2j / 2j+1', () => {
    const qf = layout.columns[0].cells.map(c => c.match.match2id);
    const sf0 = layout.columns[1].cells[0];
    const feeders = edgesInto(layout, 1)
      .filter(e => e.toY === sf0.centerY)
      .map(e => qf[layout.columns[0].cells.findIndex(c => c.centerY === e.fromY)]);
    expect(new Set(feeders)).toEqual(new Set(['QF-M001', 'QF-M003']));
  });

  it('reorders the quarterfinals so the connectors do not cross', () => {
    expect(layout.columns[0].cells.map(c => c.match.match2id)).toEqual([
      'QF-M001', 'QF-M003', 'QF-M002', 'QF-M004',
    ]);
  });

  it('merges the three mini-brackets into one chain: no dividers, real round names', () => {
    expect(layout.columns.map(c => c.startsStage)).toEqual([false, false, false]);
    expect(layout.columns.map(c => c.label)).toEqual([
      { kind: 'i18n', key: 'bracket_quarterfinals' },
      { kind: 'i18n', key: 'bracket_semifinals' },
      { kind: 'i18n', key: 'bracket_final' },
    ]);
  });

  it('centres each child between the two matches that fed it', () => {
    const [qf, sf, f] = layout.columns;
    expect(sf.cells[0].centerY).toBe((qf.cells[0].centerY + qf.cells[1].centerY) / 2);
    expect(sf.cells[1].centerY).toBe((qf.cells[2].centerY + qf.cells[3].centerY) / 2);
    expect(f.cells[0].centerY).toBe((sf.cells[0].centerY + sf.cells[1].centerY) / 2);
  });

  it('draws nothing when the previous round has not been played yet', () => {
    const unplayed = blast.map(m =>
      m.match2id?.startsWith('QF') ? ({ ...m, status: 'upcoming', winner_id: null } as PandaMatch) : m,
    );
    expect(edgesInto(buildBracketLayout(unplayed), 1)).toHaveLength(0);
  });
});

describe('buildBracketLayout — non-tree rounds', () => {
  // Round 3 of the CCT Swiss stage: three separate matchlists (High/Mid/Low).
  const swiss = [
    listNode('C1Fqjy4lmv_0001', 'Round 3', 4, 1),
    listNode('C1Fqjy4lmv_0002', 'Round 3', 4, 2),
    listNode('wCFxgw4ieC_0001', 'Round 3', 5, 1),
    listNode('INSrpGDVA0_0001', 'Round 4', 6, 1),
  ];

  it('collapses a section into one column and draws no connectors', () => {
    const layout = buildBracketLayout(swiss);
    expect(layout.columns.map(c => c.label)).toEqual([
      { kind: 'raw', text: 'Round 3' },
      { kind: 'raw', text: 'Round 4' },
    ]);
    expect(layout.columns.map(c => c.cells.length)).toEqual([3, 1]);
    expect(layout.edges).toHaveLength(0);
  });

  it('orders a section by bracketIndex then matchIndex', () => {
    const layout = buildBracketLayout([...swiss].reverse());
    expect(layout.columns[0].cells.map(c => c.match.match2id)).toEqual([
      'C1Fqjy4lmv_0001', 'C1Fqjy4lmv_0002', 'wCFxgw4ieC_0001',
    ]);
  });

  it('puts the tree after the Swiss rounds and separates the two stages', () => {
    const layout = buildBracketLayout([...swiss, ...singleElim16()]);
    expect(layout.columns.map(c => c.label.kind)).toEqual([
      'raw', 'raw', 'i18n', 'i18n', 'i18n', 'i18n',
    ]);
    expect(layout.columns.map(c => c.startsStage)).toEqual([
      false, false, true, false, false, false,
    ]);
  });
});

describe('buildBracketLayout — degraded input', () => {
  it('still groups by section when bracket_data is missing, without inventing links', () => {
    const legacy = [
      { id: 1, match2id: 'a', section: 'Round 1' },
      { id: 2, match2id: 'b', section: 'Round 1' },
      { id: 3, match2id: 'c', section: 'Quarterfinals' },
    ] as unknown as PandaMatch[];

    const layout = buildBracketLayout(legacy);
    expect(layout.columns.map(c => c.label)).toEqual([
      { kind: 'raw', text: 'Round 1' },
      { kind: 'raw', text: 'Quarterfinals' },
    ]);
    expect(layout.edges).toHaveLength(0);
  });

  it('drops matches with neither a section nor bracket data', () => {
    const layout = buildBracketLayout([{ id: 1, match2id: 'a' }] as unknown as PandaMatch[]);
    expect(layout.columns).toHaveLength(0);
  });

  it('deduplicates repeated match entries', () => {
    const dupes = [...singleElim16(), ...singleElim16()];
    expect(buildBracketLayout(dupes).columns.map(c => c.cells.length)).toEqual([8, 4, 2, 1]);
  });
});
