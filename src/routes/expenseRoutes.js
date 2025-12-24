const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { createExpense, getExpenses } = require('../controllers/expenseController');

router.use(auth);

router.post('/', createExpense);
router.get('/', getExpenses);

module.exports = router;