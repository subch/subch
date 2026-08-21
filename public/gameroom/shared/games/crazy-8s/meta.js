export const meta = {
  id: 'crazy-8s',
  name: "Crazy 8's",
  icon: 'crazy-8s',
  players: { min: 2, max: 4 },
  category: 'cards',
  rated: true, // elo applies only to exactly-2-human games anyway
  hiddenInfo: true,
  enabled: true,
  options: [
    {
      key: 'draw', label: 'Draw rule', type: 'choice',
      choices: [['3', 'Draw up to 3'], ['toPlay', 'Draw until you can play']],
      default: '3',
    },
  ],
};
