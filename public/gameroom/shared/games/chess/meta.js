export const meta = {
  id: 'chess',
  name: 'Chess',
  icon: 'chess',
  players: { min: 2, max: 2 },
  category: 'board',
  rated: true,
  hiddenInfo: false,
  enabled: true,
  options: [
    { key: 'showLegal', label: 'Show legal moves', type: 'boolean', default: true },
  ],
};
