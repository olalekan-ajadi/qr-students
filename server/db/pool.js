const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

// Hosted Postgres providers (Neon, Render, Supabase, etc.) require SSL, while a
// local database does not. Detect a local connection string and toggle SSL
// accordingly.
const url = process.env.DATABASE_URL || "";
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

module.exports = pool;
