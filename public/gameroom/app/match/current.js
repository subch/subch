// The one in-flight match (a MatchSource). Table and result screens read it;
// setup writes it.
let current = null;

export const setCurrent = (source) => { current = source; };
export const getCurrent = () => current;
