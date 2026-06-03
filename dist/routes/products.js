"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upload_1 = __importDefault(require("../middleware/upload"));
const auth_1 = require("../middleware/auth");
const productController_1 = require("../controllers/productController");
const router = (0, express_1.Router)();
// ── Admin-only routes ─────────────────────────────────────────────────────────
// POST   /api/products/bulk-upload  → admin only
router.post('/bulk-upload', auth_1.protect, auth_1.adminOnly, upload_1.default.single('file'), productController_1.bulkUploadProducts);
// PUT    /api/products/:id          → admin only
router.put('/:id', auth_1.protect, auth_1.adminOnly, productController_1.updateProduct);
// DELETE /api/products/:id          → admin only
router.delete('/:id', auth_1.protect, auth_1.adminOnly, productController_1.deleteProduct);
// ── Public routes (cashiers + anyone) ────────────────────────────────────────
// GET    /api/products              → public
router.get('/', productController_1.getAllProducts);
// GET    /api/products/barcode/:code → public (cashier barcode scan)
// NOTE: must be before /:id to avoid "barcode" being matched as an ObjectId
router.get('/barcode/:code', productController_1.getProductByBarcode);
// GET    /api/products/:id          → public
router.get('/:id', productController_1.getProductById);
exports.default = router;
