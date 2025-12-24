const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  getDailyStats,
  getMonthlyStats,
  getRangeStats,
} = require("../controllers/statsController");
const { getMaxListeners } = require("../models/User");

router.use(auth);

router.get("/daily", getDailyStats);
router.get("/monthly", getMonthlyStats);
router.get("/range", getRangeStats);

module.exports = router;

  