// LocalSource: runs the engine in the browser for pass-and-play. Implements
// the MatchSource interface that RoomSource (Phase 2) mirrors:
//   getState() getLegal() getStatus() move(m) requestUndo() answerUndo(ok)
//   resign(seat) offerDraw(seat) answerDraw(ok) rematch() abandon() subscribe(fn)
import { api } from '../api.js';
import { seedFromClock } from '/shared/rng.js';

export class LocalSource {
  constructor({ engine, meta, options, seats }) {
    this.engine = engine;
    this.meta = meta;
    this.options = options || {};
    this.baseSeats = seats;            // [{profileId, seatToken, guest, name, avatar, color, level}]
    this.assign = seats.map((_, i) => i); // seat -> base index; rematch rotates this
    this.listeners = new Set();
    this.mode = 'local';
  }

  get players() {
    return this.assign.map((bi, seat) => ({ seat, ...this.baseSeats[bi] }));
  }

  get localSeats() {
    return this.players.map((p) => p.seat);
  }

  start() {
    this.startedAt = new Date().toISOString();
    this._clockStart = null; // controller-owned game clock (see table.js)
    const seatInfo = this.players.map((p) => ({
      seat: p.seat, profileId: p.profileId || null, level: p.level || 1,
    }));
    this.state = this.engine.init(this.options, seedFromClock(), seatInfo);
    this.history = [{ state: this.state }];
    this.moveLog = [];
    this.over = false;
    this.aborted = false;
    this.result = null;
    this.recorded = null;
    this.recording = null;
    this.emit({ type: 'update', lastMove: null });
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(evt) { this.listeners.forEach((fn) => fn(evt)); }

  getState() { return this.state; }
  getLegal() { return this.over ? [] : this.engine.legalMoves(this.state); }
  getStatus() { return this.engine.status(this.state); }

  async move(m) {
    if (this.over) return;
    const desc = this.engine.describe ? this.engine.describe(this.state, m) : null;
    const mover = this.state.turn;
    this.state = this.engine.apply(this.state, m);
    this.history.push({ state: this.state });
    this.moveLog.push(m);
    this.emit({ type: 'update', lastMove: m, mover, desc });
    const st = this.engine.status(this.state);
    if (st.over) this.finish(st);
  }

  finish(st) {
    if (this.over) return;
    this.over = true;
    this.result = st;
    this.recording = this.record(st);
    this.emit({ type: 'over', status: st });
  }

  async record(st) {
    if (this.aborted) return null;
    try {
      this.recorded = await api.post('/api/matches', {
        gameId: this.meta.id,
        mode: this.mode,
        options: this.options,
        startedAt: this.startedAt,
        seats: this.players.map((p) => (p.guest
          ? { seat: p.seat, guest: true }
          : { seat: p.seat, profileId: p.profileId, seatToken: p.seatToken || undefined })),
        winnerSeat: st.winner ?? null,
        reason: st.reason || '',
        scores: st.scores || undefined,
        moves: this.moveLog,
      });
      this.emit({ type: 'recorded', recorded: this.recorded });
      return this.recorded;
    } catch (e) {
      this.emit({ type: 'recordError', error: e });
      return null;
    }
  }

  // Undo reverts to the most recent state where it was the requester's turn
  // AND that was the first step of their turn — multi-step turns undo as one.
  lastMover() {
    if (this.history.length < 2) return null;
    return this.history[this.history.length - 2].state.turn;
  }

  requestUndo() {
    if (this.over || this.history.length < 2) return;
    this.emit({ type: 'undoRequest', seat: this.lastMover() });
  }

  answerUndo(ok) {
    if (!ok) { this.emit({ type: 'undoDenied' }); return; }
    const requester = this.lastMover();
    if (requester === null) return;
    for (let i = this.history.length - 2; i >= 0; i--) {
      const isTheirTurn = this.history[i].state.turn === requester;
      const firstStep = i === 0 || this.history[i - 1].state.turn !== requester;
      if (isTheirTurn && firstStep) {
        this.history = this.history.slice(0, i + 1);
        this.moveLog = this.moveLog.slice(0, i);
        this.state = this.history[i].state;
        this.emit({ type: 'update', lastMove: null, undo: true });
        return;
      }
    }
  }

  resign(seat) {
    if (this.over) return;
    const others = this.players.filter((p) => p.seat !== seat);
    const winner = others.length === 1 ? others[0].seat : null;
    this.finish({ over: true, winner, reason: 'resign' });
  }

  offerDraw(seat) {
    if (this.over) return;
    this.emit({ type: 'drawOffer', seat });
  }

  answerDraw(ok) {
    if (!ok) { this.emit({ type: 'drawDenied' }); return; }
    this.finish({ over: true, winner: null, reason: 'draw agreed' });
  }

  // Alternates who moves first / swaps sides by rotating seat→player by one.
  rematch() {
    this.assign = this.assign.map((_, i) => this.assign[(i + 1) % this.assign.length]);
    this.start();
    this.emit({ type: 'rematch' });
  }

  // Left via menu — never recorded.
  abandon() {
    this.aborted = true;
    this.over = true;
  }
}
