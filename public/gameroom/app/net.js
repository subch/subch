// road-trip stub: no live tables on a static host
export function connect() { return new Promise(() => {}); }
export async function send() { throw new Error('Live tables need the home server'); }
export function onMessage() { return () => {}; }
export function request() { return Promise.reject(new Error('Live tables only work on the home wifi')); }
