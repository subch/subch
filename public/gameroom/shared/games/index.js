// Game registry. Imports only each game's meta.js (light), never the engine,
// so the hub doesn't pull every rules module (or vendored chess.js) up front.
// Engines load on demand via loadEngine(id).
import { meta as ticTacToe } from './tic-tac-toe/meta.js';
import { meta as war } from './war/meta.js';
import { meta as crazy8s } from './crazy-8s/meta.js';
import { meta as checkers } from './checkers/meta.js';
import { meta as connectFour } from './connect-four/meta.js';
import { meta as chess } from './chess/meta.js';
import { meta as quarto } from './quarto/meta.js';
import { meta as mancala } from './mancala/meta.js';
import { meta as dotsAndBoxes } from './dots-and-boxes/meta.js';
import { meta as mathDuel } from './math-duel/meta.js';
import { meta as goFish } from './go-fish/meta.js';
import { meta as memoryMatch } from './memory-match/meta.js';
import { meta as go } from './go/meta.js';

// Hub display order (mirrors the approved mockup; games appear as they land).
export const GAMES = [checkers, chess, quarto, war, crazy8s, goFish, memoryMatch, ticTacToe, connectFour, mancala, dotsAndBoxes, mathDuel, go];

export const gameMeta = (id) => GAMES.find((g) => g.id === id) || null;

export function loadEngine(id) {
  if (!gameMeta(id)) return Promise.reject(new Error(`unknown game: ${id}`));
  return import(`./${id}/engine.js`);
}
