const Sale = require("../models/Sale");
const Product = require("../models/Product");

// petit helper date pour e-commerce list
function makeDayRange(dateStr) {
  const day = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ---------- CREATE SALE ----------
exports.createSale = async (req, res) => {
  try {
    const {
      date,
      paymentType,
      items,
      creditInfo,
      isEcommerce,
    } = req.body;

    if (
      !paymentType ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message:
          "Payment type and at least one item are required",
      });
    }

    // Normaliser le flag e-commerce (accepte true / "true" / 1 / "1")
    const isEcommerceFlag =
      isEcommerce === true ||
      isEcommerce === "true" ||
      isEcommerce === 1 ||
      isEcommerce === "1";

    let totalAmount = 0;
    let saleBenefitTotal = 0;
    const saleItems = [];

    for (const item of items) {
      const {
        productId,
        quantity,
        unitPrice,
        isDecant,
        decantMl,
      } = item;

      const product = await Product.findById(productId);
      if (!product) {
        return res
          .status(400)
          .json({ message: `Product not found: ${productId}` });
      }

      const price =
        typeof unitPrice === "number"
          ? unitPrice
          : product.sellingPrice;

      const purchasePrice = product.purchasePrice || 0;
      const sizeMl =
        product.sizeMl ||
        product.volumeMl ||
        product.ml ||
        null;

      if (isDecant) {
        // ---------- VENTE DÉCANT ----------
        let mlSale = Number(decantMl);
        if (!mlSale || mlSale <= 0) {
          return res.status(400).json({
            message: `Décant ml invalide pour ${product.name}`,
          });
        }
        if (!sizeMl || sizeMl <= 0) {
          return res.status(400).json({
            message: `Ce produit n'a pas de taille de flacon (sizeMl) définie: ${product.name}`,
          });
        }

        let decantRemaining =
          product.decantMlRemaining || 0;
        let flaconStock = product.stock || 0;

        // si aucun flacon ouvert → en ouvrir un
        if (decantRemaining <= 0) {
          if (flaconStock <= 0) {
            return res.status(400).json({
              message: `Plus de flacons en stock pour ${product.name}`,
            });
          }
          flaconStock -= 1;
          decantRemaining = sizeMl;
        }

        // on peut ouvrir plusieurs flacons si besoin
        while (mlSale > decantRemaining && flaconStock > 0) {
          mlSale -= decantRemaining;
          flaconStock -= 1;
          decantRemaining = sizeMl;
        }

        if (mlSale > decantRemaining) {
          return res.status(400).json({
            message: `Pas assez de stock décant pour ${product.name}`,
          });
        }

        // consommer le reste
        decantRemaining -= mlSale;

        product.stock = flaconStock;
        product.decantMlRemaining = decantRemaining;
        await product.save();

        // coût d'achat du décant
        const costPerMl =
          sizeMl && purchasePrice
            ? purchasePrice / sizeMl
            : 0;
        const costForDecant = costPerMl * mlSale;
        const benefitLine = price - costForDecant;

        saleBenefitTotal += benefitLine;
        totalAmount += price;

        saleItems.push({
          product: product._id,
          productName: product.name,
          quantity: 1,
          unitPrice: price,
          total: price,
          isDecant: true,
          decantMl: mlSale,
          purchaseUnitCost: costForDecant,
          benefit: benefitLine,
        });
      } else {
        // ---------- VENTE FLACON COMPLET / ACCESSOIRE ----------
        const q = Number(quantity);
        if (!q || q <= 0) {
          return res.status(400).json({
            message: `Quantité invalide pour ${product.name}`,
          });
        }

        if (product.stock < q) {
          return res.status(400).json({
            message: `Stock insuffisant pour ${product.name}. Stock: ${product.stock}`,
          });
        }

        // pour toutes les ventes (normal + e-commerce), on décrémente le stock.
        product.stock -= q;
        await product.save();

        const lineTotal = price * q;
        const costPerUnit = purchasePrice || 0;
        const costForLine = costPerUnit * q;
        const benefitLine = lineTotal - costForLine;

        saleBenefitTotal += benefitLine;
        totalAmount += lineTotal;

        saleItems.push({
          product: product._id,
          productName: product.name,
          quantity: q,
          unitPrice: price,
          total: lineTotal,
          isDecant: false,
          purchaseUnitCost: costPerUnit,
          benefit: benefitLine,
        });
      }
    }

    // Gestion du crédit global (si paiement=credit)
    let finalCreditInfo = undefined;
    if (paymentType === "credit") {
      const paid = Number(creditInfo?.paidNow || 0);
      const remaining = Number(
        creditInfo?.remaining || totalAmount - paid
      );
      finalCreditInfo = {
        paidNow: paid < 0 ? 0 : paid,
        remaining: remaining < 0 ? 0 : remaining,
        phone: creditInfo?.phone,
        dueDate: creditInfo?.dueDate,
      };
    }

    const saleDate = date ? new Date(date) : new Date();

    const sale = await Sale.create({
      date: saleDate,
      paymentType,
      items: saleItems,
      totalAmount,
      benefitTotal: saleBenefitTotal,
      creditInfo: finalCreditInfo || null,

      // 🔹 E-commerce:
      // - vente classique: isEcommerce = false, ecommerceStatus = "delivered"
      // - e-commerce:      isEcommerce = true,  ecommerceStatus = "pending"
      isEcommerce: isEcommerceFlag,
      ecommerceStatus: isEcommerceFlag
        ? "pending"
        : "delivered",

      createdBy: req.user ? req.user._id : null,
    });

    res.status(201).json(sale);
  } catch (err) {
    console.error("Create sale error", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- GET SALES (jour / mois, toutes ventes) ----------
exports.getSales = async (req, res) => {
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
      const [year, m] = month.split("-").map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const sales = await Sale.find(filter)
      .sort({ date: -1 })
      .limit(200);

    res.json(sales);
  } catch (err) {
    console.error("Get sales error", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- LISTE DES VENTES E-COMMERCE ----------
exports.getEcommerceSales = async (req, res) => {
  try {
    const { status, date } = req.query;

    const filter = { isEcommerce: true };
    if (status) filter.ecommerceStatus = status;

    if (date) {
      const { start, end } = makeDayRange(date);
      filter.date = { $gte: start, $lte: end };
    }

    const sales = await Sale.find(filter)
      .sort({ date: -1 })
      .populate("items.product");

    res.json(sales);
  } catch (err) {
    console.error("Get ecommerce sales error", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- METTRE À JOUR LE PAIEMENT CRÉDIT ----------
exports.updateCreditPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const payment = Number(amount);
    if (!payment || payment <= 0) {
      return res
        .status(400)
        .json({ message: "Montant invalide" });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res
        .status(404)
        .json({ message: "Vente introuvable" });
    }

    if (sale.paymentType !== "credit") {
      return res.status(400).json({
        message: "Cette vente n’est pas à crédit",
      });
    }

    if (!sale.creditInfo) {
      sale.creditInfo = {
        paidNow: 0,
        remaining: sale.totalAmount,
      };
    }

    const currentPaid = Number(
      sale.creditInfo.paidNow || 0
    );
    const newPaid = currentPaid + payment;

    let remaining = sale.totalAmount - newPaid;
    if (remaining < 0) remaining = 0;

    sale.creditInfo.paidNow = newPaid;
    sale.creditInfo.remaining = remaining;

    await sale.save();

    res.json(sale);
  } catch (err) {
    console.error(
      "Update credit payment error",
      err.message
    );
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- CONFIRMER OU ANNULER VENTE E-COMMERCE ----------
exports.updateEcommerceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "delivered" | "returned"

    if (!["delivered", "returned"].includes(status)) {
      return res.status(400).json({
        message: "Statut invalide (delivered / returned)",
      });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res
        .status(404)
        .json({ message: "Vente introuvable" });
    }

    if (!sale.isEcommerce) {
      return res.status(400).json({
        message: "Cette vente n'est pas e-commerce",
      });
    }

    if (sale.ecommerceStatus !== "pending") {
      return res.status(400).json({
        message:
          "Cette vente a déjà un statut final (delivered/returned)",
      });
    }

    // si retour -> remettre le stock
    if (status === "returned") {
      for (const item of sale.items) {
        const product = await Product.findById(
          item.product
        );
        if (!product) continue;

        if (item.isDecant) {
          // on remet les ml vendus dans le stock décant
          const sizeMl =
            product.sizeMl ||
            product.volumeMl ||
            product.ml ||
            null;
          if (!sizeMl || sizeMl <= 0) continue;

          let decantRemaining =
            product.decantMlRemaining || 0;
          let mlBack = Number(item.decantMl || 0);
          if (!mlBack || mlBack <= 0) continue;

          decantRemaining += mlBack;

          // si on dépasse un flacon → on reconstitue des flacons fermés
          while (decantRemaining >= sizeMl) {
            product.stock = (product.stock || 0) + 1;
            decantRemaining -= sizeMl;
          }

          product.decantMlRemaining = decantRemaining;
          await product.save();
        } else {
          // flacon / accessoire
          product.stock =
            (product.stock || 0) +
            (item.quantity || 0);
          await product.save();
        }
      }
    }

    sale.ecommerceStatus = status;
    await sale.save();

    res.json(sale);
  } catch (err) {
    console.error(
      "Update ecommerce status error",
      err.message
    );
    res.status(500).json({ message: "Server error" });
  }
};
