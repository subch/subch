const THEME_BG = {
  felt: '#0d2b21',
  walnut: '#1a110b',
  candy: '#fff0f6',
  arcade: '#070b1a',
};

// ?theme= is a test-only override used by the screenshot script.
export function applyTheme(theme) {
  const forced = new URLSearchParams(location.search).get('theme');
  const t = THEME_BG[forced] ? forced : (THEME_BG[theme] ? theme : 'felt');
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_BG[t]);
}
