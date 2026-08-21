export const meta = {
  id: 'math-duel',
  name: 'Math Duel',
  icon: 'math-duel',
  players: { min: 1, max: 4 },
  category: 'math',
  rated: false, // levels differ — tally wins only
  hiddenInfo: false,
  enabled: true,
  options: [
    {
      key: 'mode', label: 'Game', type: 'choice',
      choices: [['quickfire', 'Quick Fire'], ['make24', 'Make 24']],
      default: 'quickfire',
    },
  ],
};
