export const meta = {
  id: 'memory-match',
  name: 'Memory Match',
  icon: 'memory-match',
  players: { min: 1, max: 4 },
  category: 'cards',
  rated: false, // tallies only; solo = practice
  hiddenInfo: false, // everyone sees the same table
  enabled: true,
  options: [
    {
      key: 'pairs', label: 'Board', type: 'choice',
      choices: [['6', 'Easy · 4×3'], ['10', '5×4'], ['12', 'Big · 6×4']],
      default: '10',
    },
  ],
};
