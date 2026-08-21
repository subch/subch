// Thin glue: loads the engine, builds the MatchSource, and parks it in
// current.js for the table/result screens. Phase 2 adds startRoomMatch here.
import { loadEngine, gameMeta } from '/shared/games/index.js';
import { LocalSource } from './local-source.js';
import { setCurrent } from './current.js';

export async function startLocalMatch({ gameId, options, seats }) {
  const engine = await loadEngine(gameId);
  const source = new LocalSource({ engine, meta: gameMeta(gameId), options, seats });
  source.start();
  setCurrent(source);
  return source;
}
