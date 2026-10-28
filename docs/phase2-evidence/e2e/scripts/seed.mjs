/** Seed users for the real-stack E2E run. Usage: node seed.mjs <backendDir>  (PG* env from caller) */
import path from "path";
import { createRequire } from "module";
const require = createRequire(path.join(process.argv[2], "package.json"));
const bcrypt = require("bcrypt");
const pg = require("pg");
const db = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT), database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD });
await db.connect();
const hash = await bcrypt.hash("Passw0rdGood", 4);
const users = [
  ["E2E Super", "super@e2e.invalid", "super_admin", "en"],
  ["E2E Admin", "admin@e2e.invalid", "admin", "en"],
  ["E2E Instructor", "instructor@e2e.invalid", "instructor", "en"],
  ["Ali Student", "student-en@e2e.invalid", "student", "en"],
  ["Sana Student", "student-ur@e2e.invalid", "student", "ur"],
];
for (const [name, email, role, lang] of users) {
  await db.query(
    `INSERT INTO users (name, email, password, role, verified, provider, language_preference)
     VALUES ($1, $2, $3, $4, TRUE, 'manual', $5) ON CONFLICT (email) DO NOTHING`,
    [name, email, hash, role, lang]
  );
}
console.log("seeded", users.length);
await db.end();
