import { getCurrent, setCurrent } from '../match/current.js';
import { navigate } from '../router.js';
import { h, avHtml, esc, confirmSheet, toast } from '../ui.js';
import { session } from '../session.js';
import { sfx } from '../sounds.js';

export async function table(root) {
  const source = getCurrent();
  if (!source) { navigate('#/'); return; }
  if (source.over) { navigate(source.result ? '#/result' : '#/'); return; }
  const meta = source.meta;

  const el = h(`
    <div class="wrap">
      <div class="backbar">
        <button class="btn ghost-btn" data-menu>‹ Menu</button>
        <h1 class="backbar-title">${esc(meta.name)}</h1>
        <span class="backbar-spacer"></span>
      </div>
      <div class="game">
        <div class="table-surface"><div class="rail"><div data-board></div></div></div>
        <div class="panel">
          <div class="turn active" data-turn></div>
          <div class="timerbar" data-timer hidden><i style="width:100%"></i></div>
          <div class="btns">
            <button class="btn" data-undo>Undo last move</button>
            <button class="btn" data-draw>Offer a draw</button>
            <button class="btn danger" data-resign>Resign</button>
          </div>
        </div>
      </div>
    </div>`);
  root.appendChild(el);

  const turnEl = el.querySelector('[data-turn]');
  const timerEl = el.querySelector('[data-timer]');
  const undoBtn = el.querySelector('[data-undo]');

  const viewMod = await import(`/games/${meta.id}/view.js`);
  const view = viewMod.mount(el.querySelector('[data-board]'), {
    players: source.players,
    localSeats: source.localSeats,
    options: source.options,
    onMove: (m) => source.move(m).catch((e) => toast(e.message)),
    theme: session.me?.theme || 'felt',
    describe: source.engine.describe,
  });

  let timerInt = null;
  const clearTimer = () => { clearInterval(timerInt); timerInt = null; timerEl.hidden = true; };

  function setupTimer() {
    clearTimer();
    const tfn = source.engine.timer;
    if (!tfn || source.over) return;
    const t = tfn(source.getState());
    if (!t) { source._clockStart = null; return; }
    // kind:'game' keeps one clock running across turns; kind:'turn' restarts
    // with every move. The controller owns wall time — engines never see it.
    if (t.kind !== 'game' || !source._clockStart) source._clockStart = Date.now();
    timerEl.hidden = false;
    const total = t.seconds;
    const bar = timerEl.querySelector('i');
    const tick = () => {
      const left = total - (Date.now() - source._clockStart) / 1000;
      bar.style.width = `${Math.max(0, (left / total) * 100)}%`;
      if (left <= 0) {
        clearTimer();
        const move = source.getLegal().find((m) => m.type === 'timeout');
        if (move) source.move(move);
      }
    };
    tick();
    timerInt = setInterval(tick, 250);
  }

  function paintTurn(st) {
    const state = source.getState();
    const p = source.players[state.turn];
    turnEl.innerHTML = `${avHtml(p, 'med')}<div><div class="t1">${esc(p.name)}'s move</div><div class="t2">${esc(st?.note || '')}</div></div>`;
  }

  function refresh(evt) {
    const state = source.getState();
    const legal = source.getLegal();
    const st = source.getStatus();
    view.update(state, legal, evt?.lastMove ?? null, st);
    paintTurn(st);
    undoBtn.disabled = source.history.length < 2;
    if (!source.over && legal.length === 1 && legal[0].type === 'pass') {
      toast(`${source.players[state.turn].name} has no moves — passing`);
      setTimeout(() => {
        // re-check: the state may have moved on (undo, debug driver, …)
        if (source.over) return;
        const now = source.getLegal();
        if (now.length === 1 && now[0].type === 'pass') {
          source.move(now[0]).catch(() => {});
        }
      }, 800);
    }
    setupTimer();
  }

  const otherThan = (seat) =>
    source.players.find((p) => p.seat !== seat) || source.players[seat];

  const unsub = source.subscribe(async (evt) => {
    if (evt.type === 'update') {
      if (evt.lastMove) sfx.tap();
      refresh(evt);
    } else if (evt.type === 'undoRequest') {
      const who = source.players[evt.seat];
      const ok = await confirmSheet({
        title: `${who.name} wants to take back a move`,
        body: `${otherThan(evt.seat).name}, is that OK?`,
        yes: "That's fine", no: 'Keep playing',
      });
      source.answerUndo(ok);
    } else if (evt.type === 'drawOffer') {
      const who = source.players[evt.seat];
      const ok = await confirmSheet({
        title: `${who.name} offers a draw`,
        body: `${otherThan(evt.seat).name}, accept?`,
        yes: 'Accept the draw', no: 'Play on',
      });
      source.answerDraw(ok);
    } else if (evt.type === 'over') {
      clearTimer();
      setTimeout(() => navigate('#/result'), 750);
    }
  });

  el.querySelector('[data-menu]').onclick = async () => {
    const ok = await confirmSheet({
      title: 'Leave this game?',
      body: "It won't be recorded.",
      yes: 'Leave', no: 'Keep playing', danger: true,
    });
    if (ok) { source.abandon(); setCurrent(null); navigate('#/'); }
  };
  undoBtn.onclick = () => source.requestUndo();
  el.querySelector('[data-draw]').onclick = () => source.offerDraw(source.getState().turn);
  el.querySelector('[data-resign]').onclick = async () => {
    const seat = source.getState().turn;
    const who = source.players[seat];
    const ok = await confirmSheet({
      title: `${who.name}, really resign?`,
      body: 'This counts as a loss.',
      yes: 'Resign', no: 'Keep playing', danger: true,
    });
    if (ok) source.resign(seat);
  };

  refresh(null);
  return { destroy() { unsub(); clearTimer(); view.destroy?.(); } };
}
