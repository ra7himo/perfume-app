const Sale = require("../models/Sale");
const Expense = require("../models/Expense");
const Purchase = require("../models/Purchase");

// --- Helpers dates ---
function makeDayRange(dateStr) {
  const day = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function makeRange(fromStr, toStr) {
  if (!fromStr || !toStr) {
    const today = new Date();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const start = new Date(today);
    start.setDate(start.getDate() - 6); // last 7 days
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);

  const start = from <= to ? from : to;
  const end = from <= to ? to : from;

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// --- Helpers ventes / crédits ---
function getCreditInfo(sale) {
  return sale.creditInfo || sale.credit || sale.creditDetails || null;
}

function isCreditSale(sale) {
  const pt = (sale.paymentType || "").toLowerCase();
  const hasCredit = !!getCreditInfo(sale);
  const tagged =
    pt === "credit" || pt === "crédit" || pt === "credit_sale";
  return hasCredit || tagged;
}

// Argent qui rentre dans la caisse
function getCashFromSaleDoc(sale) {
  if (isCreditSale(sale)) {
    const c = getCreditInfo(sale) || {};
    const paid = Number(c.paidNow ?? c.paye ?? c.paid ?? 0);
    return isNaN(paid) ? 0 : paid;
  }

  // sinon on prend le montant total de la vente
  if (typeof sale.totalAmount === "number") return sale.totalAmount;
  if (!Array.isArray(sale.items)) return 0;

  return sale.items.reduce((sum, it) => {
    const q = it.quantity || 0;
    const p = it.unitPrice || 0;
    return sum + q * p;
  }, 0);
}

// Somme des bénéfices stockés sur chaque item de vente
function getMarginFromSaleDoc(sale) {
  if (!Array.isArray(sale.items)) return 0;
  return sale.items.reduce((sum, it) => {
    if (typeof it.benefit === "number") {
      return sum + it.benefit;
    }
    return sum;
  }, 0);
}

// --- Fonction centrale: calcule les stats pour une période ---
async function computeStatsForRange(start, end) {
  const [sales, expenses, purchases] = await Promise.all([
    Sale.find({ date: { $gte: start, $lte: end } }),
    Expense.find({ date: { $gte: start, $lte: end } }),
    Purchase.find({ date: { $gte: start, $lte: end } }),
  ]);

  let salesTotal = 0;          // argent qui rentre dans la caisse
  let marginFromSales = 0;     // somme (prix vente - prix d'achat) de chaque item

  for (const s of sales) {
    // 🔹IMPORTANT:
    // Ne pas compter les ventes e-commerce tant que le client n'a pas récupéré le colis.
    // - isEcommerce = true & ecommerceStatus = "pending"  -> ignoré
    // - isEcommerce = true & ecommerceStatus = "returned" -> ignoré
    // - isEcommerce = true & ecommerceStatus = "delivered" -> compté normalement
    if (s.isEcommerce && s.ecommerceStatus !== "delivered") {
      continue;
    }

    salesTotal += getCashFromSaleDoc(s);
    marginFromSales += getMarginFromSaleDoc(s);
  }

  const expensesTotal = expenses.reduce(
    (sum, e) => sum + (e.amount || 0),
    0
  );

  const purchasesTotal = purchases.reduce(
    (sum, p) => sum + (p.totalCost || 0),
    0
  );

  // Net = Ventes - Charges
  const net = salesTotal - expensesTotal;

  // Bénéfice = (Ventes - prix d'achat des produits vendus) - Charges
  //           = marge des ventes - Charges
  const benefit = marginFromSales - expensesTotal;

  return {
    salesTotal,
    expensesTotal,
    purchasesTotal,
    net,
    benefit,
    marginFromSales,
  };
}

// ---------- /api/stats/daily?date=YYYY-MM-DD ----------
exports.getDailyStats = async (req, res) => {
  try {
    const { date } = req.query;
    const { start, end } = makeDayRange(date);

    const stats = await computeStatsForRange(start, end);

    res.json({
      date: start.toISOString().slice(0, 10),
      ...stats,
    });
  } catch (err) {
    console.error("Daily stats error", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- /api/stats/monthly?month=YYYY-MM ----------
exports.getMonthlyStats = async (req, res) => {
  try {
    const { month } = req.query;

    let year, m;
    if (month) {
      [year, m] = month.split("-").map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      m = now.getMonth() + 1;
    }

    const start = new Date(year, m - 1, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, m, 0, 23, 59, 59, 999);

    const stats = await computeStatsForRange(start, end);

    res.json({
      month: `${year}-${String(m).padStart(2, "0")}`,
      ...stats,
    });
  } catch (err) {
    console.error("Monthly stats error", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- /api/stats/range?from=YYYY-MM-DD&to=YYYY-MM-DD ----------
exports.getRangeStats = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { start, end } = makeRange(from, to);

    const stats = await computeStatsForRange(start, end);

    res.json({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      ...stats,
    });
  } catch (err) {
    console.error("Range stats error", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
