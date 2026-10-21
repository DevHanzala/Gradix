import db, { withTransaction } from "../DB/db.js";
import { AppError } from "../utils/AppError.js";

/**
 * Groups (classes, departments). Scope rules:
 *  - super_admin: manages every group and its members.
 *  - admin: sees only the groups they belong to, and manages (role changes
 *    between student and instructor) only users who share a group with them.
 *  - instructor: sees their own groups and can enroll a whole group.
 *  - student: no group management.
 */
const invalid = (message) => new AppError("INVALID_GROUP", 400, message);
const notFound = () => new AppError("GROUP_NOT_FOUND", 404, "Group not found");

/** Does `admin` share at least one group with `targetUserId`? */
export const sharesGroupQuery = async (userId, targetUserId, client = db) => {
  const { rows } = await client.query(
    `SELECT 1 FROM group_memberships a JOIN group_memberships b ON a.group_id = b.group_id
     WHERE a.user_id = $1 AND b.user_id = $2 LIMIT 1`,
    [userId, targetUserId]
  );
  return rows.length > 0;
};

/** Users visible to an admin: everyone in the admin's groups (plus the admin). */
export const findScopedUsersQuery = async (adminId) => {
  const { rows } = await db.query(
    `SELECT DISTINCT u.id, u.name, u.email, u.role, u.verified, u.created_at, u.language_preference
     FROM users u
     WHERE u.deleted_at IS NULL
       AND (u.id = $1 OR u.id IN (
         SELECT b.user_id FROM group_memberships a JOIN group_memberships b ON a.group_id = b.group_id WHERE a.user_id = $1))
     ORDER BY u.created_at DESC`,
    [adminId]
  );
  return rows;
};

const groupRow = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  memberCount: Number(r.member_count) || 0,
  studentCount: Number(r.student_count) || 0,
  createdAt: r.created_at,
});

export const listGroupsService = async (user) => {
  const scoped = user.role !== "super_admin";
  const { rows } = await db.query(
    `SELECT g.*,
            (SELECT count(*) FROM group_memberships m JOIN users u ON u.id = m.user_id WHERE m.group_id = g.id AND u.deleted_at IS NULL) AS member_count,
            (SELECT count(*) FROM group_memberships m JOIN users u ON u.id = m.user_id
              WHERE m.group_id = g.id AND u.role = 'student' AND u.deleted_at IS NULL) AS student_count
     FROM groups g
     ${scoped ? "WHERE EXISTS (SELECT 1 FROM group_memberships m WHERE m.group_id = g.id AND m.user_id = $1)" : ""}
     ORDER BY LOWER(g.name)`,
    scoped ? [user.id] : []
  );
  return rows.map(groupRow);
};

const requireGroup = async (groupId, user, client = db) => {
  const id = Number.parseInt(groupId, 10);
  if (!Number.isInteger(id)) throw notFound();
  const { rows } = await client.query(`SELECT * FROM groups WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound();
  if (user.role !== "super_admin") {
    const member = await client.query(`SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2`, [id, user.id]);
    // Another institution's group is reported as missing.
    if (!member.rows.length) throw notFound();
  }
  return rows[0];
};

const normalizeGroupInput = (body) => {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 150) throw invalid("Group name must be 2 to 150 characters.");
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 1000) : null;
  return { name, description: description || null };
};

const uniqueName = (error) => {
  if (error.code === "23505") throw new AppError("GROUP_EXISTS", 409, "A group with this name already exists.");
  throw error;
};

export const createGroupService = async (user, body) => {
  const { name, description } = normalizeGroupInput(body);
  const { rows } = await db
    .query(`INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`, [name, description, user.id])
    .catch(uniqueName);
  return groupRow(rows[0]);
};

export const updateGroupService = async (user, groupId, body) => {
  const group = await requireGroup(groupId, user);
  const { name, description } = normalizeGroupInput(body);
  const { rows } = await db
    .query(`UPDATE groups SET name = $2, description = $3, updated_at = NOW() WHERE id = $1 RETURNING *`, [group.id, name, description])
    .catch(uniqueName);
  return groupRow(rows[0]);
};

export const deleteGroupService = async (user, groupId) => {
  const group = await requireGroup(groupId, user);
  await db.query(`DELETE FROM groups WHERE id = $1`, [group.id]);
  return { id: group.id };
};

export const listMembersService = async (user, groupId) => {
  const group = await requireGroup(groupId, user);
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.role, m.created_at AS added_at
     FROM group_memberships m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1 AND u.deleted_at IS NULL
     ORDER BY u.role, LOWER(u.name)`,
    [group.id]
  );
  return { group: groupRow({ ...group, member_count: rows.length, student_count: rows.filter((r) => r.role === "student").length }), members: rows };
};

/** Add members by email. Unknown emails are reported, not created. */
export const addMembersService = async (user, groupId, emails) => {
  const group = await requireGroup(groupId, user);
  const list = [...new Set((Array.isArray(emails) ? emails : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!list.length) throw invalid("Enter at least one email address.");
  if (list.length > 500) throw invalid("Add at most 500 members at once.");
  return withTransaction(async (client) => {
    const { rows: users } = await client.query(
      `SELECT id, email FROM users WHERE LOWER(email) = ANY($1::text[]) AND deleted_at IS NULL`,
      [list]
    );
    const found = new Set(users.map((u) => u.email.toLowerCase()));
    let added = 0;
    for (const u of users) {
      const { rowCount } = await client.query(
        `INSERT INTO group_memberships (group_id, user_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [group.id, u.id, user.id]
      );
      added += rowCount;
    }
    return { added, notFound: list.filter((e) => !found.has(e)) };
  });
};

export const removeMemberService = async (user, groupId, memberId) => {
  const group = await requireGroup(groupId, user);
  const { rowCount } = await db.query(`DELETE FROM group_memberships WHERE group_id = $1 AND user_id = $2`, [
    group.id,
    Number.parseInt(memberId, 10) || 0,
  ]);
  if (!rowCount) throw new AppError("MEMBER_NOT_FOUND", 404, "This user is not in the group.");
  return { removed: true };
};

/** Students of a group the requester may use (instructor/admin: own groups). */
export const groupStudentsForEnrollment = async (user, groupId) => {
  const group = await requireGroup(groupId, user);
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.language_preference
     FROM group_memberships m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1 AND u.role = 'student' AND u.deleted_at IS NULL`,
    [group.id]
  );
  return { group, students: rows };
};
