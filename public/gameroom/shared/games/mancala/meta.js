export const meta = {
  id: 'mancala',
  name: 'Mancala',
  icon: 'mancala',
  players: { min: 2, max: 2 },
  category: 'board',
  rated: true,
  hiddenInfo: false,
  enabled: true,
  options: [
    {
      key: 'stones', label: 'Stones per pit', type: 'choice',
      choices: [['3', '3'], ['4', '4'], ['6', '6']], default: '4',
    },
  ],
};
