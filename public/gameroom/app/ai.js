// Client bridge to the AI worker, with a main-thread fallback if module
// workers are unavailable.
let worker = null;
let workerDead = false;
const pending = new Map();
let seq = 0;

function ensureWorker() {
  if (worker || workerDead) return;
  try {
    worker = new Worker('/app/ai-worker.js', { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.move);
    };
    worker.onerror = () => {
      workerDead = true;
      for (const p of pending.values()) p.reject(new Error('worker failed'));
      pending.clear();
      worker = null;
    };
  } catch {
    workerDead = true;
  }
}

async function mainThreadMove(gameId, state, level) {
  try {
    const ai = await import(`/shared/games/${gameId}/ai.js`);
    return ai.chooseMove(state, level);
  } catch {
    const engine = await import(`/shared/games/${gameId}/engine.js`);
    const { randomMove } = await import('/shared/ai/minimax.js');
    return randomMove(engine, state);
  }
}

export async function aiMove(gameId, state, level) {
  ensureWorker();
  if (!worker) return mainThreadMove(gameId, state, level);
  const id = ++seq;
  try {
    return await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, gameId, state, level });
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error('AI timeout')); }
      }, 10_000);
    });
  } catch {
    return mainThreadMove(gameId, state, level);
  }
}
