const pool = require("./db");

const moduleConfig = {
  cashbook: {
    table: "cash_book",
    fields: ["entry_date", "particulars", "entry_type", "amount", "payment_method"],
    orderBy: "entry_date DESC, id DESC"
  },
  purchases: {
    table: "purchases",
    fields: ["party_no", "bill_no", "purchase_date", "item_name", "supplier", "quantity", "rate", "amount", "payment_method", "note"],
    orderBy: "purchase_date DESC, id DESC"
  },
  sales: {
    table: "sales",
    fields: ["sale_date", "item_name", "quantity", "rate", "amount", "customer"],
    orderBy: "sale_date DESC, id DESC"
  },
  parties: {
    table: "parties",
    fields: ["party_name", "phone", "opening_debit", "opening_credit", "opening_balance", "opening_date", "balance", "party_type"],
    orderBy: "id DESC"
  },
  items: {
    table: "items",
    fields: ["item_name", "category", "stock", "unit_price"],
    orderBy: "id DESC"
  },
  reminders: {
    table: "reminders",
    fields: ["title", "note", "due_date", "status"],
    orderBy: "due_date ASC, id DESC"
  }
};

function getConfig(moduleName) {
  const config = moduleConfig[moduleName];
  if (!config) {
    throw new Error("Invalid module");
  }
  return config;
}

async function getRows(moduleName) {
  const { table, orderBy } = getConfig(moduleName);
  const result = await pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT 200`);
  return result.rows;
}

async function createRow(moduleName, payload) {
  const { table, fields } = getConfig(moduleName);
  const normalizedPayload = { ...payload };

  if (moduleName === "purchases" || moduleName === "sales") {
    const quantity = Number(payload.quantity || 0);
    const rate = Number(payload.rate || 0);
    normalizedPayload.quantity = quantity;
    normalizedPayload.rate = rate;
    normalizedPayload.amount = Number((quantity * rate).toFixed(2));
  }

  if (moduleName === "parties") {
    const openingDebit = Number(payload.opening_debit || 0);
    const openingCredit = Number(payload.opening_credit || 0);
    const openingBalance = Number((openingDebit - openingCredit).toFixed(2));

    normalizedPayload.opening_debit = openingDebit;
    normalizedPayload.opening_credit = openingCredit;
    normalizedPayload.opening_balance = openingBalance;
    normalizedPayload.balance = openingBalance;
    normalizedPayload.opening_date = payload.opening_date || new Date().toISOString().slice(0, 10);
  }

  const values = fields.map((field) => normalizedPayload[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(", ");
  const query = `
    INSERT INTO ${table} (${fields.join(", ")})
    VALUES (${placeholders})
    RETURNING *;
  `;
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function updateRow(moduleName, id, payload) {
  const { table, fields } = getConfig(moduleName);
  const normalizedPayload = { ...payload };

  if (moduleName === "purchases" || moduleName === "sales") {
    const quantity = Number(payload.quantity || 0);
    const rate = Number(payload.rate || 0);
    normalizedPayload.quantity = quantity;
    normalizedPayload.rate = rate;
    normalizedPayload.amount = Number((quantity * rate).toFixed(2));
  }

  if (moduleName === "parties") {
    const openingDebit = Number(payload.opening_debit || 0);
    const openingCredit = Number(payload.opening_credit || 0);
    const openingBalance = Number((openingDebit - openingCredit).toFixed(2));

    normalizedPayload.opening_debit = openingDebit;
    normalizedPayload.opening_credit = openingCredit;
    normalizedPayload.opening_balance = openingBalance;
    normalizedPayload.balance = openingBalance;
    normalizedPayload.opening_date = payload.opening_date || new Date().toISOString().slice(0, 10);
  }

  const assignments = fields.map((field, index) => `${field} = $${index + 1}`).join(", ");
  const values = fields.map((field) => normalizedPayload[field]);
  const query = `
    UPDATE ${table}
    SET ${assignments}
    WHERE id = $${fields.length + 1}
    RETURNING *;
  `;
  const result = await pool.query(query, [...values, id]);
  return result.rows[0] || null;
}

async function deleteRow(moduleName, id) {
  const { table } = getConfig(moduleName);
  const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]);
  return result.rowCount > 0;
}

module.exports = { getRows, createRow, updateRow, deleteRow, getConfig };
