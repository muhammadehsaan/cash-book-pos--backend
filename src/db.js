const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const connectionString = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/cashbok_dashboard";
const needsSsl = /neon\.tech|sslmode=require|sslmode=verify-full/i.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false
});

module.exports = pool;
