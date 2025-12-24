const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  adjustStock,
  createDecantFromPerfume,
  getBestSellers
} = require('../controllers/productController');

router.use(auth);

router.post('/', createProduct);
router.get('/', getProducts);
router.get('/best-sellers', getBestSellers);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.patch('/:id/stock', adjustStock);
router.post('/:id/decants', createDecantFromPerfume);

module.exports = router;