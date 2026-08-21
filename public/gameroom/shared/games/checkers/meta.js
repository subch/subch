export const meta = {
  id: 'checkers',
  name: 'Checkers',
  icon: 'checkers',
  players: { min: 2, max: 2 },
  category: 'board',
  rated: true,
  hiddenInfo: false,
  enabled: true,
  options: [
    { key: 'forcedCapture', label: 'Forced captures', type: 'boolean', default: true },
    { key: 'fortyMoveDraw', label: 'Auto-draw after 40 quiet moves', type: 'boolean', default: true },
  ],
};
