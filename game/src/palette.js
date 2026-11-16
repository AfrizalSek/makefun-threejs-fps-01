// The look plan, in one place. Desert dusk: warm sand, plaster walls, teal site
// accents, danger orange for the enemy team. The same names are the CSS custom
// properties in index.html. No other colour appears in the code.
export const PALETTE = {
  canvas: '#dfa26e',
  surface: '#b98d5f',
  hairline: '#8a6b45',
  ink: '#f2ead8',
  muted: '#8a7d68',
  accent: '#2fa08c',
  danger: '#d95d39',
};

export function shade(name) {
  return PALETTE[name];
}
