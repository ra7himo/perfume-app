// backend/src/models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    brand: { type: String },

    // perfume | accessory (on garde aussi decant si tu veux plus tard)
    type: {
      type: String,
      enum: ["perfume", "accessory", "decant"],
      default: "perfume",
    },

    // quantité du flacon COMPLET (ex: 100ml)
    sizeMl: { type: Number, default: 0 },

    // PRIX D'ACHAT du flacon complet (ce que tu paies au fournisseur)
    purchasePrice: { type: Number, default: 0 },

    // PRIX DE VENTE du flacon complet
    sellingPrice: { type: Number, required: true },

    // paramètre pour décant (optionnel, utile pour ton UI)
    decantSizeMl: { type: Number, default: 10 },
    decantPrice: { type: Number, default: 0 },

    // nombre de flacons fermés que tu as en stock
    stock: { type: Number, default: 0 },

    // nombre de flacons minimum pour alerte stock bas
    lowStockThreshold: { type: Number, default: 1 },

    // combien de ML restent dans le flacon OUVERT pour les décants
    decantMlRemaining: { type: Number, default: 0 },

    // si un produit est un décant lié à un autre (on laisse pour futur)
    parentProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    barcode: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
