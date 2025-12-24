// backend/src/controllers/productController.js
const Product = require("../models/Product");
const Sale = require("../models/Sale");

/**
 * POST /api/products
 */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      brand,
      type,           // "perfume" | "decant" | "accessory"
      sizeMl,
      parentProductId,
      purchasePrice,
      sellingPrice,
      stock,
      lowStockThreshold,
      barcode,
    } = req.body;

    if (!name || !type || typeof sellingPrice !== "number") {
      return res
        .status(400)
        .json({ message: "Name, type et sellingPrice sont requis" });
    }

    const product = await Product.create({
      name,
      brand,
      type,
      sizeMl,
      parentProductId: parentProductId || null,
      purchasePrice: typeof purchasePrice === "number" ? purchasePrice : 0,
      sellingPrice,
      stock: typeof stock === "number" ? stock : 0,
      lowStockThreshold:
        typeof lowStockThreshold === "number" ? lowStockThreshold : 1,
      barcode,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("Create product error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/products?q=...&type=perfume
 */
exports.getProducts = async (req, res) => {
  try {
    const { q, type } = req.query;
    const filter = {};

    if (q) {
      filter.name = { $regex: q, $options: "i" };
    }
    if (type) {
      filter.type = type;
    }

    const products = await Product.find(filter).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    console.error("Get products error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/products/:id
 */
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error("Get product by id error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /api/products/:id
 */
exports.updateProduct = async (req, res) => {
  try {
    const updates = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error("Update product error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/products/:id/stock
 * body: { stock: number }
 */
exports.adjustStock = async (req, res) => {
  try {
    const { stock } = req.body;

    if (typeof stock !== "number") {
      return res
        .status(400)
        .json({ message: "Stock must be a number" });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true }
    );

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error("Adjust stock error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/products/:id/decants
 * créer un produit décant à partir d'un parfum parent
 */
exports.createDecantFromPerfume = async (req, res) => {
  try {
    const perfumeId = req.params.id;
    const { name, sizeMl, sellingPrice, stock } = req.body;

    const parent = await Product.findById(perfumeId);

    if (!parent || parent.type !== "perfume") {
      return res
        .status(400)
        .json({ message: "Parent product must be a perfume" });
    }

    if (!sizeMl || !sellingPrice) {
      return res.status(400).json({
        message: "Size (ml) et sellingPrice sont requis pour un décant",
      });
    }

    const decant = await Product.create({
      name: name || `${parent.name} ${sizeMl}ml décant`,
      brand: parent.brand,
      type: "decant",
      sizeMl,
      parentProductId: parent._id,
      purchasePrice: parent.purchasePrice, // tu peux adapter si besoin
      sellingPrice,
      stock: typeof stock === "number" ? stock : 0,
      lowStockThreshold: 1,
    });

    res.status(201).json(decant);
  } catch (err) {
    console.error("Create decant error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/products/best-sellers?from=2025-01-01&to=2025-01-31&limit=10
 */
exports.getBestSellers = async (req, res) => {
  try {
    const { from, to, limit } = req.query;

    const match = {};
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    const max = parseInt(limit, 10) || 10;

    const pipeline = [
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.total" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: max },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          name: "$product.name",
          type: "$product.type",
          sellingPrice: "$product.sellingPrice",
          stock: "$product.stock",
          totalQuantity: 1,
          totalRevenue: 1,
        },
      },
    ];

    const results = await Sale.aggregate(pipeline);

    res.json(results);
  } catch (err) {
    console.error("Best sellers error", err);
    res.status(500).json({ message: "Server error" });
  }
};
