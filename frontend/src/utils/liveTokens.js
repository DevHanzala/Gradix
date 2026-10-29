/** Participant tokens per session, kept in this browser so a refresh or reconnect resumes. */
const KEY = "gradix.live";

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};

export const saveLiveToken = (sessionId, token) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [sessionId]: token }));
  } catch {
    // Private mode: the token lives only in memory for this page.
  }
};

export const liveTokenFor = (sessionId) => read()[sessionId] || null;

export const forgetLiveToken = (sessionId) => {
  const all = read();
  delete all[sessionId];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
};
