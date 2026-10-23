/**
 * Each person keeps one quiet colour across the calendar (avatar, month dots, filters),
 * picked from muted tones that sit with the module colours.
 */
const PALETTE = [
  '#2f6ba8',
  '#2e6f66',
  '#a0662c',
  '#7a4f9a',
  '#b0476b',
  '#4d7a2e',
  '#3d5a8a',
  '#8a5a44',
  '#2f7f99',
  '#6b6b2e',
];

export function personColor(id: string, order: string[]): string {
  const index = order.indexOf(id);
  return PALETTE[(index >= 0 ? index : hash(id)) % PALETTE.length] ?? '#5c6472';
}

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** 日岡 那綺 → 日岡 ; Vraj Admin → VA */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (/^[\x20-\x7e]+$/.test(name)) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
  return (parts[0] ?? name).slice(0, 2);
}
