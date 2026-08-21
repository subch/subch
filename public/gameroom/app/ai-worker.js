// AI web worker: keeps the search off the UI thread so boards stay smooth.
// Falls back to a random legal move for games without a dedicated brain.
self.onmessage = async (e) => {
  const { id, gameId, state, level } = e.data;
  try {
    let move = null;
    try {
      const ai = await import(`/shared/games/${gameId}/ai.js`);
      move = ai.chooseMove(state, level);
    } catch {
      const engine = await import(`/shared/games/${gameId}/engine.js`);
      const { randomMove } = await import('/shared/ai/minimax.js');
      move = randomMove(engine, state);
    }
    self.postMessage({ id, move });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
