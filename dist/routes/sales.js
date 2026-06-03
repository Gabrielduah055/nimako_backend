"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const saleController_1 = require("../controllers/saleController");
const router = (0, express_1.Router)();
// All sales routes require authentication
router.use(auth_1.protect);
// POST   /api/sales                        → cashier or admin (create sale)
router.post('/', saleController_1.createSale);
// GET    /api/sales/today                  → cashier or admin
router.get('/today', saleController_1.getTodaySales);
// GET    /api/sales/report                 → admin only
router.get('/report', auth_1.adminOnly, saleController_1.getSalesByDateRange);
// GET    /api/sales/invoice/:invoiceNumber → cashier or admin (receipt)
router.get('/invoice/:invoiceNumber', saleController_1.getSaleByInvoice);
// GET    /api/sales/cashier/:cashierId     → admin only
router.get('/cashier/:cashierId', auth_1.adminOnly, saleController_1.getCashierSales);
exports.default = router;
