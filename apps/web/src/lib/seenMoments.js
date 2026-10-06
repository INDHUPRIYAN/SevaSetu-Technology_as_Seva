// Which one-time moment screens this browser has already shown (the "closed" moment opens once from
// My Seva, then stays reachable by its link). Storage may be unavailable; then nothing repeats.
export const seenMoment = key => { try { return localStorage.getItem(`moment:${key}`) === '1'; } catch { return true; } };
export const markMomentSeen = key => { try { localStorage.setItem(`moment:${key}`, '1'); } catch { /* fine */ } };
