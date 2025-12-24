const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  createSale,
  getSales,
  updateCreditPayment,
  getEcommerceSales,
  updateEcommerceStatus,
} = require("../controllers/saleController");

router.use(auth);

router.post("/", createSale);
router.get("/", getSales);

// liste e-commerce
router.get("/ecommerce", getEcommerceSales);

// paiements crédit
router.patch("/:id/credit", updateCreditPayment);

// valider / annuler e-commerce
router.patch("/:id/ecommerce-status", updateEcommerceStatus);

module.exports = router;
