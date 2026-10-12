import bcrypt from "bcrypt";
import pool from "../DB/db.js";
import { requireEnv } from "../config/env.js";

/**
 * Bootstraps the single Super Admin account.
 * Credentials come from SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD (and optional
 * SUPERADMIN_NAME). The password is never printed. Run migrations first.
 */
const MIN_PASSWORD_LENGTH = 12;

const createSuperAdmin = async () => {
  let email;
  let password;
  try {
    email = requireEnv("SUPERADMIN_EMAIL").trim().toLowerCase();
    password = requireEnv("SUPERADMIN_PASSWORD");
  } catch (error) {
    console.error(`Refusing to run: ${error.message}`);
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Refusing to run: SUPERADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const name = process.env.SUPERADMIN_NAME?.trim() || "Super Administrator";

  try {
    const { rows: existing } = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    if (existing.length > 0) {
      console.error("A Super Admin already exists. Nothing was changed.");
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role, verified, provider)
       VALUES ($1, $2, $3, 'super_admin', TRUE, 'manual')
       RETURNING id, email`,
      [name, email, hashedPassword]
    );

    console.log(`Super Admin created (id ${rows[0].id}, ${rows[0].email}).`);
    process.exit(0);
  } catch (error) {
    console.error(`Failed to create Super Admin: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
};

createSuperAdmin();
