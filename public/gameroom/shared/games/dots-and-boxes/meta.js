export const meta = {
  id: 'dots-and-boxes',
  name: 'Dots & Boxes',
  icon: 'dots-and-boxes',
  players: { min: 2, max: 4 },
  category: 'board',
  rated: true, // elo applies only to exactly-2-human games
  hiddenInfo: false,
  enabled: true,
  options: [
    {
      key: 'size', label: 'Board', type: 'choice',
      choices: [['3', '3×3'], ['5', '5×5'], ['7', '7×7 (big tablets)']],
      default: '5',
    },
  ],
};
