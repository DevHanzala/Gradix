/**
 * How the live service tells connected clients that something changed. The
 * Socket.IO layer (services/live/realtime.js) replaces these when the server
 * starts; tests can replace them to capture events. Without either, nothing is sent.
 */
export const liveEvents = {
  /** Session state changed (join, answer, control action...). */
  changed: () => {},
  /** A participant was removed by the teacher. */
  removed: () => {},
};
