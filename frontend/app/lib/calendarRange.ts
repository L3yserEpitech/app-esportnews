// The calendars always render 11 days centered on index 5. Each breakpoint shows
// one more on each side (5, 7, 9, 11 columns), so the centered day stays on screen.
export function calendarCellVisibility(index: number): string {
  const distance = Math.abs(index - 5);
  if (distance <= 2) return '';
  if (distance === 3) return 'hidden sm:flex';
  if (distance === 4) return 'hidden md:flex';
  return 'hidden lg:flex';
}
