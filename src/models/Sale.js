const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true },

  // décant info
  isDecant: { type: Boolean, default: false },
  decantMl: { type: Number },

  // pour calculer les bénéfices
  purchaseUnitCost: { type: Number, default: 0 }, // coût utilisé pour 1 "unité" (flacon ou décant)
  benefit: { type: Number, default: 0 }, // marge de cette ligne
});

const creditInfoSchema = new mongoose.Schema(
  {
    paidNow: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    phone: String,
    dueDate: Date,
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    paymentType: {
      type: String,
      enum: ["cash", "credit"],
      required: true,
    },

    items: [saleItemSchema],
    totalAmount: { type: Number, required: true },

    // somme des "benefit" de chaque item
    benefitTotal: { type: Number, default: 0 },

    // crédit global
    creditInfo: creditInfoSchema,

    // E-commerce
    isEcommerce: { type: Boolean, default: false },
    // pending: en attente, delivered: client l'a pris, returned: retour/annulé
    ecommerceStatus: {
      type: String,
      enum: ["pending", "delivered", "returned"],
      default: "pending",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// évite OverwriteModelError
module.exports =
  mongoose.models.Sale || mongoose.model("Sale", saleSchema);
