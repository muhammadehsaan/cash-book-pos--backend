const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const { getOverview } = require("./dashboardService");
const { getRows, createRow, updateRow, deleteRow, getConfig } = require("./moduleService");
const { initializeDatabase } = require("./bootstrap");

const app = express();
const dbStatus = {
  ready: false,
  message: "Database not initialized yet."
};
let dbInitPromise = null;
let lastDbWarning = "";

function getRequiredFields(moduleName, fields) {
  if (moduleName === "purchases" || moduleName === "sales") {
    return fields.filter((field) => field !== "amount");
  }

  if (moduleName === "parties") {
    return fields.filter((field) => !["opening_debit", "opening_credit", "opening_balance", "balance"].includes(field));
  }

  return fields;
}

function getErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }

  if (error.message) {
    return error.message;
  }

  if (error.code) {
    return `PostgreSQL error code ${error.code}`;
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.map(getErrorMessage).join("; ");
  }

  if (error.cause) {
    return getErrorMessage(error.cause);
  }

  return String(error);
}

async function ensureDatabaseReady() {
  if (dbStatus.ready) {
    return true;
  }

  if (!dbInitPromise) {
    dbInitPromise = initializeDatabase()
      .then(() => {
        dbStatus.ready = true;
        dbStatus.message = "Database connected.";
        return true;
      })
      .catch((error) => {
        const warning = getErrorMessage(error);

        dbStatus.ready = false;
        dbStatus.message = "PostgreSQL connection failed. Update backend/.env DATABASE_URL with the correct username, password and database.";
        if (warning !== lastDbWarning) {
          console.error("Database initialization warning:", warning);
          lastDbWarning = warning;
        }
        return false;
      })
      .finally(() => {
        dbInitPromise = null;
      });
  }

  return dbInitPromise;
}

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "dashboard-backend",
    message: "Backend is running. Use /api/health to check database status.",
    endpoints: ["/api/health", "/api/dashboard/overview"]
  });
});

app.get("/api/health", async (_req, res) => {
  await ensureDatabaseReady();
  res.json({ ok: true, service: "dashboard-backend", databaseReady: dbStatus.ready, databaseMessage: dbStatus.message });
});

app.get("/api/dashboard/overview", async (_req, res) => {
  if (!(await ensureDatabaseReady())) {
    return res.status(503).json({ message: dbStatus.message });
  }

  try {
    const data = await getOverview();
    res.json(data);
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error.message);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

app.get("/api/:module", async (req, res) => {
  if (!(await ensureDatabaseReady())) {
    return res.status(503).json({ message: dbStatus.message });
  }

  try {
    getConfig(req.params.module);
    const data = await getRows(req.params.module);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to fetch module data" });
  }
});

app.post("/api/:module", async (req, res) => {
  if (!(await ensureDatabaseReady())) {
    return res.status(503).json({ message: dbStatus.message });
  }

  try {
    const moduleName = req.params.module;
    const { fields } = getConfig(moduleName);
    const payload = {};
    const requiredFields = getRequiredFields(moduleName, fields);

    for (const field of fields) {
      payload[field] = req.body[field];
      if (requiredFields.includes(field) && (payload[field] === undefined || payload[field] === null || payload[field] === "")) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    const row = await createRow(moduleName, payload);
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to create module row" });
  }
});

app.put("/api/:module/:id", async (req, res) => {
  if (!(await ensureDatabaseReady())) {
    return res.status(503).json({ message: dbStatus.message });
  }

  try {
    const moduleName = req.params.module;
    const { fields } = getConfig(moduleName);
    const payload = {};
    const requiredFields = getRequiredFields(moduleName, fields);

    for (const field of fields) {
      payload[field] = req.body[field];
      if (requiredFields.includes(field) && (payload[field] === undefined || payload[field] === null || payload[field] === "")) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    const row = await updateRow(moduleName, req.params.id, payload);
    if (!row) {
      return res.status(404).json({ message: "Record not found" });
    }
    return res.json(row);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to update module row" });
  }
});

app.delete("/api/:module/:id", async (req, res) => {
  if (!(await ensureDatabaseReady())) {
    return res.status(503).json({ message: dbStatus.message });
  }

  try {
    getConfig(req.params.module);
    const deleted = await deleteRow(req.params.module, req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Record not found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to delete record" });
  }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  await ensureDatabaseReady();

  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

startServer();
