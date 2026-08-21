export const meta = {
  id: 'war',
  name: 'War',
  icon: 'war',
  players: { min: 2, max: 4 },
  category: 'cards',
  // Elo only for the classic variant (and only ever with exactly 2 humans).
  rated: (options) => (options?.variant || 'classic') === 'classic',
  hiddenInfo: false, // the only hidden info is pile order, which nobody can see anyway
  enabled: true,
  options: [
    {
      key: 'length', label: 'Length', type: 'choice',
      choices: [['showdown', '10-minute showdown'], ['end', 'Play to the end']],
      default: 'showdown',
    },
    {
      key: 'variant', label: 'Variant', type: 'choice',
      choices: [['classic', 'Classic'], ['sum', 'Sum (add 2)'], ['product', 'Product (multiply 2)']],
      default: 'classic',
    },
  ],
};
