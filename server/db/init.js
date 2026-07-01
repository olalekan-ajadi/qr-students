const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const pool = require("./pool");

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("Tables created.");

  const email = process.env.ADMIN_EMAIL || "admin@university.edu.ng";
  const existing = await pool.query("SELECT 1 FROM admins WHERE email=$1", [email]);
  if (existing.rowCount === 0) {
    // Use ADMIN_PASSWORD from .env, or generate a random one and print it once.
    const generated = !process.env.ADMIN_PASSWORD;
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
    const hash = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO admins (full_name,email,password_hash) VALUES ($1,$2,$3)",
      ["System Administrator", email, hash]);
    console.log("\nDefault admin created:");
    console.log("  Email:    " + email);
    console.log("  Password: " + password + (generated ? "   (randomly generated — save it now)" : ""));
    console.log("Change this password after first login.\n");
  } else {
    console.log("Default admin already exists.");
  }
  await pool.end();
}
init().catch((e) => { console.error(e); process.exit(1); });
