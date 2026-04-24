const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const connectionString = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/cashbok_dashboard";

const pool = new Pool({ connectionString });

module.exports = pool;
