const pool = require("./db");

async function getOverview() {
  const summaryQuery = `
    SELECT
      COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)::float AS total_revenue,
      COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)::float AS total_expense,
      COUNT(*)::int AS total_orders,
      COALESCE(AVG(amount), 0)::float AS average_order_value
    FROM cash_book;
  `;

  const monthlySalesQuery = `
    SELECT TO_CHAR(DATE_TRUNC('month', entry_date), 'Mon') AS month,
           COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)::float AS sales
    FROM cash_book
    WHERE created_at >= NOW() - INTERVAL '5 months'
    GROUP BY DATE_TRUNC('month', entry_date)
    ORDER BY DATE_TRUNC('month', entry_date);
  `;

  const recentOrdersQuery = `
    SELECT id,
           particulars AS customer,
           CASE WHEN entry_type = 'income' THEN 'Income' ELSE 'Expense' END AS status,
           amount::float,
           payment_method AS payment
    FROM cash_book
    ORDER BY created_at DESC
    LIMIT 6;
  `;

  const [summaryResult, monthlySalesResult, recentOrdersResult] = await Promise.all([
    pool.query(summaryQuery),
    pool.query(monthlySalesQuery),
    pool.query(recentOrdersQuery)
  ]);

  const summaryRow = summaryResult.rows[0];

  return {
    summary: {
      totalRevenue: summaryRow.total_revenue,
      totalExpense: summaryRow.total_expense,
      totalOrders: summaryRow.total_orders,
      totalCustomers: summaryRow.total_orders,
      averageOrderValue: summaryRow.average_order_value
    },
    monthlySales: monthlySalesResult.rows,
    recentOrders: recentOrdersResult.rows
  };
}

module.exports = { getOverview };
