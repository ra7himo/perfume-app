const express = require("express");
const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
// const { protect } = require("../middleware/authMiddleware"); // if you use auth

const router = express.Router();

// GET /api/purchases?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", /* protect, */ async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};

    if (from || to) {
      filter.createdAt = {};
      if (from) {
        filter.createdAt.$gte = new Date(from);
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const purchases = await Purchase.find(filter)
      .populate("product", "name brand sizeMl type")
      .sort({ createdAt: -1 });

    res.json(purchases);
  } catch (err) {
    console.error("GET /api/purchases error", err);
    res.status(500).json({ message: "Failed to load purchases" });
  }
});

// POST /api/purchases
// body: { productId, quantity, totalCost, notes }
router.post("/", /* protect, */ async (req, res) => {
  try {
    const { productId, quantity, totalCost, notes } = req.body;

    if (!productId || !quantity || !totalCost) {
      return res
        .status(400)
        .json({ message: "productId, quantity, totalCost are required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // create purchase record
    const purchase = await Purchase.create({
      product: productId,
      quantity,
      totalCost,
      notes,
    });

    // update stock: add purchased quantity
    product.stock = (product.stock || 0) + quantity;

    // optional: update average purchasePrice
    const unitCost = totalCost / quantity;
    if (!product.purchasePrice || product.purchasePrice <= 0) {
      product.purchasePrice = unitCost;
    } else {
      // simple average between old and new
      product.purchasePrice = Math.round(
        (product.purchasePrice + unitCost) / 2
      );
    }

    await product.save();

    res.status(201).json(purchase);
  } catch (err) {
    console.error("POST /api/purchases error", err);
    res.status(500).json({ message: "Failed to create purchase" });
  }
});

module.exports = router;
