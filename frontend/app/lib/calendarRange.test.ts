import { describe, expect, it } from 'vitest';
import { calendarCellVisibility } from './calendarRange';

describe('cases du calendrier selon la largeur', () => {
  it('garde le jour central visible partout et centre la fenêtre', () => {
    expect(calendarCellVisibility(5)).toBe('');
    expect(calendarCellVisibility(3)).toBe('');
    expect(calendarCellVisibility(7)).toBe('');
  });

  it('ajoute une case de chaque côté à chaque palier', () => {
    expect(calendarCellVisibility(2)).toBe('hidden sm:flex');
    expect(calendarCellVisibility(8)).toBe('hidden sm:flex');
    expect(calendarCellVisibility(1)).toBe('hidden md:flex');
    expect(calendarCellVisibility(9)).toBe('hidden md:flex');
    expect(calendarCellVisibility(0)).toBe('hidden lg:flex');
    expect(calendarCellVisibility(10)).toBe('hidden lg:flex');
  });
});
