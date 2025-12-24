const Expense = require('../models/Expense');

exports.createExpense = async (req, res) => {
  try {
    const { date, amount, description, category } = req.body;

    if (!amount || !description) {
      return res.status(400).json({ message: 'Amount and description are required' });
    }

    const expenseDate = date ? new Date(date) : new Date();

    const expense = await Expense.create({
      date: expenseDate,
      amount,
      description,
      category,
      createdBy: req.user ? req.user._id : null
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error('Create expense error', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const { date, month } = req.query;
    const filter = {};

    if (date) {
      const day = new Date(date);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    } else if (month) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const expenses = await Expense.find(filter).sort({ date: -1 }).limit(100);

    res.json(expenses);
  } catch (err) {
    console.error('Get expenses error', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};