import db from "../DB/db.js";
import { AppError } from "../utils/AppError.js";

/**
 * In-app notifications. Rows store a type and data only; the client renders
 * the text in the reader's language. Creating a notification never fails the
 * action that caused it (errors are logged).
 */
export const NOTIFICATION_TYPES = ["role_changed", "password_changed", "enrolled", "published", "results_ready"];
const LIST_LIMIT = 30;

export const notify = async (userId, type, data = {}) => {
  if (!userId || !NOTIFICATION_TYPES.includes(type)) return;
  try {
    await db.query(`INSERT INTO notifications (user_id, type, data) VALUES ($1, $2, $3)`, [userId, type, JSON.stringify(data)]);
  } catch (error) {
    console.error(`[notify] ${type} for user ${userId} failed: ${error.message}`);
  }
};

export const notifyMany = async (userIds, type, data) => {
  for (const id of userIds) await notify(id, type, data);
};

export const listNotificationsService = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, type, data, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [userId, LIST_LIMIT]
  );
  const unread = (await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [userId])).rows[0].n;
  return { items: rows, unread };
};

export const markReadService = async (userId, notificationId) => {
  const id = Number.parseInt(notificationId, 10);
  const { rows } = await db.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING id`,
    [Number.isInteger(id) ? id : 0, userId]
  );
  if (!rows[0]) throw new AppError("NOTIFICATION_NOT_FOUND", 404, "Notification not found");
  return { id: rows[0].id };
};

export const markAllReadService = async (userId) => {
  await db.query(`UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
  return { unread: 0 };
};
