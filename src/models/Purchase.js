const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // how many units you bought (flacons)
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    // total money you paid for this purchase
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // so you can use purchase.unitCost in code
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

purchaseSchema.virtual("unitCost").get(function () {
  if (!this.quantity) return 0;
  return this.totalCost / this.quantity;
});

module.exports = mongoose.model("Purchase", purchaseSchema);
