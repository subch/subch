// RoomSource: the MatchSource for live tables. Mirrors LocalSource's
// interface, but the server owns the rules — this just forwards intents and
// re-emits `table.state` broadcasts as the same events table.js/result.js
// already understand. The table and result screens can't tell the difference.
import { send, onMessage } from '../net.js';
import { gameMeta, loadEngine } from '/shared/games/index.js';

export class RoomSource {
  constructor(code, { spectate = false } = {}) {
    this.code = code;
    this.spectate = spectate;
    this.kind = 'room';
    this.meta = null;
    this.engine = {}; // filled async (describe/timer for display only)
    this.options = {};
    this.players = [];
    this.mySeats = [];
    this.state = null;
    this.legal = [];
    this.status = null;
    this.tableStatus = null;
    this.over = false;
    this.result = null;
    this.recorded = null;
    this.history = []; // length only (undo button enablement)
    this.listeners = new Set();
    this._pendingKey = null;
    this._unsub = onMessage((m) => this._handle(m));
    if (!spectate) {
      try { sessionStorage.setItem('gr-table', code); } catch { /* fine */ }
    }
    send({ t: 'table.sync', code, spectate });
  }

  // waits until the first sync lands (used after a page reload)
  ready(timeoutMs = 5000) {
    if (this.meta) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => { off(); resolve(false); }, timeoutMs);
      const off = this.subscribe(() => {
        if (this.meta) { clearTimeout(timer); off(); resolve(true); }
      });
    });
  }

  get localSeats() { return this.mySeats; }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(evt) { this.listeners.forEach((fn) => fn(evt)); }

  _handle(msg) {
    if (msg.t === 'net.open') { send({ t: 'table.sync', code: this.code, spectate: this.spectate }); return; }
    if (msg.t !== 'table.state' || msg.table?.code !== this.code) return;

    const tbl = msg.table;
    this.host = tbl.host || null;
    if (!this.meta) {
      this.meta = gameMeta(tbl.gameId);
      this.options = tbl.options || {};
      loadEngine(tbl.gameId).then((e) => { this.engine = e; });
    }
    this.players = tbl.seats.map((s) => ({
      seat: s.seat,
      profileId: s.profile?.id ?? null,
      guest: s.guest,
      name: s.profile?.name || (s.guest ? 'Guest' : '—'),
      avatar: s.profile?.avatar,
      color: s.profile?.color,
      connected: s.connected,
    }));
    this.mySeats = msg.mySeats || [];
    const wasOver = this.over;
    const hadState = !!this.state;
    this.state = msg.state;
    this.legal = msg.legal || [];
    this.status = msg.status;
    this.recorded = msg.recorded;
    this.tableStatus = tbl.status;

    if (tbl.status === 'playing' && wasOver) {
      // rematch: fresh game on the same table
      this.over = false;
      this.result = null;
      this.history = [this.state];
      this.emit({ type: 'rematch' });
    }
    if (this.state && (!hadState || tbl.status === 'playing')) {
      this.history.push(this.state);
    }

    this.emit({ type: 'update', lastMove: null });

    if (msg.recorded && !this._recordedEmitted) {
      this._recordedEmitted = true;
      this.emit({ type: 'recorded', recorded: msg.recorded });
    }
    if ((msg.status?.over || tbl.status === 'over') && !wasOver) {
      this.over = true;
      this.result = msg.status || { over: true, winner: null, reason: '' };
      this.emit({ type: 'over', status: this.result });
    }

    // undo/draw sheets: only on devices that can answer (not the asker's own)
    const p = msg.pending;
    const key = p ? `${p.kind}:${p.seat}:${this.history.length}` : null;
    if (key && key !== this._pendingKey) {
      this._pendingKey = key;
      const iAmOnlyAsker = this.mySeats.length > 0 && this.mySeats.every((s) => s === p.seat);
      if (!iAmOnlyAsker && this.mySeats.length > 0) {
        this.emit({ type: p.kind === 'undo' ? 'undoRequest' : 'drawOffer', seat: p.seat });
      }
    }
    if (!p) this._pendingKey = null;
  }

  getState() { return this.state; }
  getLegal() { return this.over ? [] : this.legal; }
  getStatus() { return this.status || { over: this.over, winner: null }; }

  async move(m) {
    if (m?.type === 'timeout') return; // the server's clock handles time
    await send({ t: 'table.move', move: m });
  }

  requestUndo() { send({ t: 'table.undo.request' }); }
  answerUndo(ok) { send({ t: 'table.undo.answer', ok }); }
  offerDraw() { send({ t: 'table.draw.offer' }); }
  answerDraw(ok) { send({ t: 'table.draw.answer', ok }); }
  resign(seat) { send({ t: 'table.resign', seat }); }
  rematch() { send({ t: 'table.rematch' }); }

  abandon() {
    send({ t: 'table.leave' });
    this.destroy();
  }

  destroy() {
    this._unsub?.();
    this._unsub = null;
    try { sessionStorage.removeItem('gr-table'); } catch { /* fine */ }
  }
}
