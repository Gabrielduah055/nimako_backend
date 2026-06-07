import { Router } from 'express';
import upload from '../middleware/upload';
import { protect, adminOnly } from '../middleware/auth';
import {
  bulkUploadProducts,
  getAllProducts,
  getLowStockProducts,
  getProductById,
  getProductByBarcode,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';

const router = Router();

// ── Admin-only routes ─────────────────────────────────────────────────────────

// POST   /api/products/bulk-upload  → admin only
router.post('/bulk-upload', protect, adminOnly, upload.single('file'), bulkUploadProducts);

// PUT    /api/products/:id          → admin only
router.put('/:id', protect, adminOnly, updateProduct);

// DELETE /api/products/:id          → admin only
router.delete('/:id', protect, adminOnly, deleteProduct);

// ── Public routes (cashiers + anyone) ────────────────────────────────────────

// GET    /api/products              → public
router.get('/', getAllProducts);

// GET    /api/products/barcode/:code → public (cashier barcode scan)
// NOTE: must be before /:id to avoid "barcode" being matched as an ObjectId
router.get('/low-stock', protect, adminOnly, getLowStockProducts);

router.get('/barcode/:code', getProductByBarcode);

// GET    /api/products/:id          → public
router.get('/:id', getProductById);

export default router;
