"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const saleController_1 = require("../controllers/saleController");
const router = (0, express_1.Router)();
// All sales routes require authentication
router.use(auth_1.protect);
// POST   /api/sales                                    → cashier or admin (create sale)
router.post('/', saleController_1.createSale);
// GET    /api/sales/today                              → cashier or admin
router.get('/today', saleController_1.getTodaySales);
// GET    /api/sales/report                             → admin only
router.get('/report', auth_1.adminOnly, saleController_1.getSalesByDateRange);
// ── Dashboard analytics (admin only) ────────────────────────────────────────
// GET /api/sales/dashboard/transactions?page=1&limit=10
router.get('/dashboard/transactions', auth_1.adminOnly, saleController_1.getDashboardTransactions);
// GET /api/sales/dashboard/chart?period=7d
router.get('/dashboard/chart', auth_1.adminOnly, saleController_1.getSalesChart);
// GET /api/sales/dashboard/top-products
router.get('/dashboard/top-products', auth_1.adminOnly, saleController_1.getTopProducts);
// GET /api/sales/dashboard/payment-breakdown
router.get('/dashboard/payment-breakdown', auth_1.adminOnly, saleController_1.getPaymentBreakdown);
// GET    /api/sales/invoice/:invoiceNumber             → cashier or admin (receipt)
router.get('/invoice/:invoiceNumber', saleController_1.getSaleByInvoice);
// GET    /api/sales/cashier/:cashierId                 → admin only
router.get('/cashier/:cashierId', auth_1.adminOnly, saleController_1.getCashierSales);
exports.default = router;
