const fs = require("fs/promises");
const path = require("path");
const pool = require("./db");

async function initializeDatabase() {
  const sqlPath = path.join(__dirname, "..", "db", "init.sql");
  const sql = await fs.readFile(sqlPath, "utf8");
  await pool.query(sql);
  return { ok: true, message: "" };
}

module.exports = { initializeDatabase };
