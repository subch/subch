// ~24 inline SVG avatar icons. Each renders inside a colored circle (the
// profile's color); glyphs are white with a soft dark edge so they read on
// any color. Heidi the family dog keeps her own colors: black coat, tall
// ears, amber eyes.
const G = 'fill="#fff" stroke="rgba(0,0,0,.25)" stroke-width="3" stroke-linejoin="round"';

export const AVATARS = {
  crown: `<path ${G} d="M18 68 L26 34 L40 50 L50 22 L60 50 L74 34 L82 68 Z"/><rect ${G} x="18" y="68" width="64" height="10" rx="3"/>`,
  queen: `<circle ${G} cx="28" cy="26" r="6"/><circle ${G} cx="50" cy="20" r="6"/><circle ${G} cx="72" cy="26" r="6"/><path ${G} d="M24 36 L50 30 L76 36 L70 66 H30 Z"/><rect ${G} x="26" y="68" width="48" height="10" rx="3"/>`,
  knight: `<path ${G} d="M32 78 h36 v-8 c0-12-3-20-8-26 3-5 7-6 9-9 -3-5-8-7-13-7 -3-5-7-8-12-11 -1 4-1 7 0 10 -5 4-9 12-9 19 l9-2 c-3 6-5 13-5 20 z"/>`,
  rook: `<path ${G} d="M30 22 h10 v8 h8 v-8 h4 v8 h8 v-8 h10 v16 h-40 z M34 40 h32 l3 26 h-38 z M30 68 h40 v10 h-40 z"/>`,
  rocket: `<path ${G} d="M50 12 C62 24 66 40 62 58 H38 C34 40 38 24 50 12 Z"/><circle fill="#7ec8e3" stroke="rgba(0,0,0,.25)" stroke-width="3" cx="50" cy="38" r="8"/><path ${G} d="M38 56 L26 72 L40 68 Z M62 56 L74 72 L60 68 Z"/><path fill="#ffb054" d="M44 62 h12 l-6 20 z"/>`,
  dino: `<path ${G} d="M30 78 V50 C30 34 42 26 56 28 l16-10 -2 14 c6 4 8 12 4 18 l-14 4 v24 h-8 l-2-10 -8 2 v8 z"/><circle fill="#1e1e1e" cx="62" cy="32" r="3"/><path ${G} d="M34 48 l-8-4 M34 58 l-10-2"/>`,
  dog: `<path fill="#1c1c1c" stroke="rgba(0,0,0,.4)" stroke-width="2" d="M32 20 L42 38 H58 L68 20 L74 44 C74 62 64 74 50 74 C36 74 26 62 26 44 Z"/><circle fill="#e8a33d" cx="41" cy="48" r="5"/><circle fill="#e8a33d" cx="59" cy="48" r="5"/><circle fill="#111" cx="41" cy="48" r="2.2"/><circle fill="#111" cx="59" cy="48" r="2.2"/><path fill="#111" d="M46 60 a4 4 0 0 0 8 0 z"/>`,
  cat: `<path ${G} d="M28 24 L40 36 H60 L72 24 L74 48 C74 64 64 74 50 74 C36 74 26 64 26 48 Z"/><circle fill="#3a3a3a" cx="41" cy="50" r="3.5"/><circle fill="#3a3a3a" cx="59" cy="50" r="3.5"/><path fill="none" stroke="#3a3a3a" stroke-width="2.5" stroke-linecap="round" d="M46 62 q4 4 8 0 M20 52 h12 M20 60 l12-3 M80 52 h-12 M80 60 l-12-3"/>`,
  star: `<path ${G} d="M50 14 L60 38 L86 40 L66 56 L72 82 L50 68 L28 82 L34 56 L14 40 L40 38 Z"/>`,
  lightning: `<path ${G} d="M58 12 L30 52 H46 L40 88 L72 42 H54 Z"/>`,
  cupcake: `<path ${G} d="M28 46 a22 18 0 0 1 44 0 z"/><path fill="#f6a7c1" stroke="rgba(0,0,0,.25)" stroke-width="3" d="M30 46 h40 l-6 32 h-28 z"/><circle fill="#c0392b" cx="50" cy="24" r="5"/>`,
  heart: `<path ${G} d="M50 80 C20 60 16 38 30 28 C40 21 48 26 50 34 C52 26 60 21 70 28 C84 38 80 60 50 80 Z"/>`,
  flower: `<g ${G}><circle cx="50" cy="30" r="11"/><circle cx="70" cy="44" r="11"/><circle cx="62" cy="66" r="11"/><circle cx="38" cy="66" r="11"/><circle cx="30" cy="44" r="11"/></g><circle fill="#ffd166" stroke="rgba(0,0,0,.25)" stroke-width="3" cx="50" cy="50" r="10"/>`,
  ghost: `<path ${G} d="M28 82 V44 a22 22 0 0 1 44 0 v38 l-8-6 -7 6 -7-6 -7 6 -7-6 z"/><circle fill="#3a3a3a" cx="42" cy="44" r="4"/><circle fill="#3a3a3a" cx="58" cy="44" r="4"/>`,
  robot: `<rect ${G} x="28" y="34" width="44" height="34" rx="6"/><circle fill="#59c2e8" stroke="rgba(0,0,0,.25)" stroke-width="2.5" cx="41" cy="50" r="5.5"/><circle fill="#59c2e8" stroke="rgba(0,0,0,.25)" stroke-width="2.5" cx="59" cy="50" r="5.5"/><rect ${G} x="40" y="70" width="20" height="8" rx="3"/><path ${G} d="M50 34 V22 M50 20 a4 4 0 1 1 .1 0"/>`,
  car: `<path ${G} d="M22 56 L30 40 C32 36 36 34 40 34 H60 C64 34 68 36 70 40 L78 56 v12 H22 Z"/><circle fill="#3a3a3a" cx="34" cy="68" r="8"/><circle fill="#3a3a3a" cx="66" cy="68" r="8"/><path fill="#7ec8e3" d="M36 40 h12 v10 h-16 z M52 40 h10 l4 10 h-14 z"/>`,
  sun: `<circle ${G} cx="50" cy="50" r="16"/><g stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M50 18 v10 M50 72 v10 M18 50 h10 M72 50 h10 M27 27 l7 7 M66 66 l7 7 M73 27 l-7 7 M34 66 l-7 7"/></g>`,
  moon: `<path ${G} d="M62 16 A36 36 0 1 0 84 62 A28 28 0 0 1 62 16 Z"/>`,
  fish: `<path ${G} d="M24 50 C34 34 50 28 64 34 L80 24 L76 46 L80 68 L64 60 C50 68 34 64 24 50 Z"/><circle fill="#3a3a3a" cx="42" cy="46" r="3.5"/>`,
  butterfly: `<path ${G} d="M48 50 C34 30 20 28 16 40 C12 52 28 60 44 58 Z M52 50 C66 30 80 28 84 40 C88 52 72 60 56 58 Z M48 54 C36 68 30 76 36 82 C42 86 48 74 50 62 Z M52 54 C64 68 70 76 64 82 C58 86 52 74 50 62 Z"/><rect fill="#3a3a3a" x="47" y="40" width="6" height="28" rx="3"/>`,
  gamepad: `<path ${G} d="M28 36 H72 C82 36 88 46 86 58 C84 68 76 72 70 66 L62 58 H38 L30 66 C24 72 16 68 14 58 C12 46 18 36 28 36 Z"/><path fill="#3a3a3a" d="M32 44 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6 z"/><circle fill="#3a3a3a" cx="64" cy="48" r="4"/><circle fill="#3a3a3a" cx="72" cy="56" r="4"/>`,
  book: `<path ${G} d="M50 26 C42 20 30 20 22 24 V72 C30 68 42 68 50 74 C58 68 70 68 78 72 V24 C70 20 58 20 50 26 Z"/><path fill="none" stroke="rgba(0,0,0,.3)" stroke-width="3" d="M50 28 V72"/>`,
  music: `<path ${G} d="M40 70 V26 L72 20 V62"/><circle ${G} cx="33" cy="70" r="9"/><circle ${G} cx="65" cy="62" r="9"/><path fill="none" stroke="#fff" stroke-width="6" d="M40 30 L72 24"/>`,
  gem: `<path ${G} d="M30 26 H70 L84 44 L50 82 L16 44 Z"/><path fill="none" stroke="rgba(0,0,0,.3)" stroke-width="2.5" d="M16 44 H84 M30 26 L42 44 L50 82 M70 26 L58 44 L50 82"/>`,
  tree: `<path ${G} d="M50 14 L70 40 H60 L76 62 H24 L40 40 H30 Z"/><rect ${G} x="44" y="62" width="12" height="18" rx="2"/>`,
};

export const AVATAR_NAMES = Object.keys(AVATARS);

export function avatarSvg(name) {
  const glyph = AVATARS[name] || AVATARS.star;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${glyph}</svg>`;
}
