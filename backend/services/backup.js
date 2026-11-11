import { gzipSync, gunzipSync } from "zlib";
import db from "../DB/db.js";
import { storage } from "../helper/storage.js";

/**
 * Logical backup of the Gradix database to file storage (R2 in production), and restore.
 * Works without pg_dump (not available on every host): every table of the public
 * schema is written as JSON lines, in foreign-key order, gzipped. The pg-boss job
 * queue (transient) is not included. Neon's own point-in-time restore is the first
 * line of defence; this is the portable copy you control.
 *
 * File format (gzip of newline-delimited JSON):
 *   {"format":"gradix-backup","version":1,"createdAt":..,"migrations":[..]}
 *   {"table":"users","columns":[..]}   then one line per row: [values...]
 * BYTEA values are written as {"$bytes":"<base64>"}.
 */
export const BACKUP_PREFIX = "backups/";
const SKIP = new Set(["pgmigrations"]);

/** Public tables ordered so that every table comes after the tables it references. */
export const tablesInOrder = async (client = db) => {
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
  );
  const { rows: refs } = await client.query(
    `SELECT tc.table_name AS child, ccu.table_name AS parent
     FROM information_schema.table_constraints tc
     JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
  );
  const names = tables.map((t) => t.table_name).filter((n) => !SKIP.has(n));
  const parents = new Map(names.map((n) => [n, new Set()]));
  for (const r of refs) if (r.child !== r.parent && parents.has(r.child) && parents.has(r.parent)) parents.get(r.child).add(r.parent);
  const ordered = [];
  const done = new Set();
  while (ordered.length < names.length) {
    const ready = names.filter((n) => !done.has(n) && [...parents.get(n)].every((p) => done.has(p)));
    if (!ready.length) throw new Error("Circular foreign keys between tables");
    for (const n of ready) {
      done.add(n);
      ordered.push(n);
    }
  }
  return ordered;
};

const encode = (value) => (Buffer.isBuffer(value) ? { $bytes: value.toString("base64") } : value instanceof Date ? value.toISOString() : value);
const decode = (value) => (value && typeof value === "object" && "$bytes" in value ? Buffer.from(value.$bytes, "base64") : value);

/** Create a backup and store it; returns { key, tables, rows, bytes }. */
export const createBackup = async ({ client = db, now = new Date() } = {}) => {
  const migrations = (await client.query(`SELECT name FROM pgmigrations ORDER BY run_on, id`)).rows.map((r) => r.name);
  const lines = [JSON.stringify({ format: "gradix-backup", version: 1, createdAt: now.toISOString(), migrations })];
  let rows = 0;
  const tables = await tablesInOrder(client);
  for (const table of tables) {
    // vector columns are read as text, which is also how they are written back.
    const { rows: cols } = await client.query(
      `SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    const select = cols.map((c) => (c.udt_name === "vector" ? `"${c.column_name}"::text AS "${c.column_name}"` : `"${c.column_name}"`)).join(", ");
    const result = await client.query(`SELECT ${select} FROM "${table}"`);
    lines.push(JSON.stringify({ table, columns: cols.map((c) => c.column_name), types: cols.map((c) => c.udt_name) }));
    for (const row of result.rows) lines.push(JSON.stringify(cols.map((c) => encode(row[c.column_name]))));
    rows += result.rows.length;
  }
  const body = gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8"));
  const key = `${BACKUP_PREFIX}gradix-${now.toISOString().replace(/[:.]/g, "-")}.ndjson.gz`;
  await storage.put(key, body, { contentType: "application/gzip" });
  return { key, tables: tables.length, rows, bytes: body.length };
};

export const listBackups = async () => (await storage.list(BACKUP_PREFIX)).sort();

/**
 * Restore a backup into a database that has the same migrations applied and is empty
 * (pass force to restore over existing rows: every table is emptied first).
 * Returns { tables, rows }.
 */
export const restoreBackup = async (key, { client: given, force = false } = {}) => {
  // One dedicated connection, so the whole restore is one transaction.
  const client = given || (await db.connect());
  try {
    return await restoreWith(client, key, force);
  } finally {
    if (!given) client.release();
  }
};

const restoreWith = async (client, key, force) => {
  const text = gunzipSync(await storage.get(key)).toString("utf8");
  const lines = text.split("\n").filter(Boolean);
  const header = JSON.parse(lines[0]);
  if (header.format !== "gradix-backup") throw new Error("Not a Gradix backup file.");
  const applied = (await client.query(`SELECT name FROM pgmigrations ORDER BY run_on, id`)).rows.map((r) => r.name);
  if (applied.join(",") !== header.migrations.join(",")) {
    throw new Error(`The database is on a different schema version (run migrations to ${header.migrations.at(-1)} first).`);
  }
  const existing = Number((await client.query(`SELECT count(*) FROM users`)).rows[0].count);
  if (existing > 0 && !force) throw new Error("The database is not empty. Restore into an empty database, or pass --force to replace everything.");

  const tables = [];
  let current = null;
  for (const line of lines.slice(1)) {
    const parsed = JSON.parse(line);
    if (!Array.isArray(parsed)) {
      current = { ...parsed, rows: [] };
      tables.push(current);
    } else current.rows.push(parsed.map(decode));
  }

  let total = 0;
  await client.query("BEGIN");
  try {
    if (force) await client.query(`TRUNCATE ${tables.map((t) => `"${t.table}"`).join(", ")} RESTART IDENTITY CASCADE`);
    for (const t of tables) {
      for (let i = 0; i < t.rows.length; i += 200) {
        const chunk = t.rows.slice(i, i + 200);
        const params = [];
        // JSON(B) columns get JSON text; arrays (int[], text[]) and the rest go as they are.
        const json = (t.types || []).map((type) => type === "json" || type === "jsonb");
        const values = chunk.map(
          (row) => `(${row.map((v, c) => (params.push(json[c] && v !== null ? JSON.stringify(v) : v), `$${params.length}`)).join(", ")})`
        );
        await client.query(`INSERT INTO "${t.table}" (${t.columns.map((c) => `"${c}"`).join(", ")}) VALUES ${values.join(", ")}`, params);
      }
      total += t.rows.length;
      // Move serial sequences past the restored ids.
      if (t.columns.includes("id") && t.rows.length) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('"${t.table}"', 'id'), (SELECT max(id) FROM "${t.table}"))
           WHERE pg_get_serial_sequence('"${t.table}"', 'id') IS NOT NULL`
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return { tables: tables.length, rows: total };
};
