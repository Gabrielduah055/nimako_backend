import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth';
import {
  createSale,
  getTodaySales,
  getSalesByDateRange,
  getSaleByInvoice,
  getCashierSales,
  getDashboardTransactions,
  getSalesChart,
  getTopProducts,
  getPaymentBreakdown,
} from '../controllers/saleController';

const router = Router();

// All sales routes require authentication
router.use(protect);

// POST   /api/sales                                    → cashier or admin (create sale)
router.post('/', createSale);

// GET    /api/sales/today                              → cashier or admin
router.get('/today', getTodaySales);

// GET    /api/sales/report                             → admin only
router.get('/report', adminOnly, getSalesByDateRange);

// ── Dashboard analytics (admin only) ────────────────────────────────────────
// GET /api/sales/dashboard/transactions?page=1&limit=10
router.get('/dashboard/transactions', adminOnly, getDashboardTransactions);

// GET /api/sales/dashboard/chart?period=7d
router.get('/dashboard/chart', adminOnly, getSalesChart);

// GET /api/sales/dashboard/top-products
router.get('/dashboard/top-products', adminOnly, getTopProducts);

// GET /api/sales/dashboard/payment-breakdown
router.get('/dashboard/payment-breakdown', adminOnly, getPaymentBreakdown);

// GET    /api/sales/invoice/:invoiceNumber             → cashier or admin (receipt)
router.get('/invoice/:invoiceNumber', getSaleByInvoice);

// GET    /api/sales/cashier/:cashierId                 → admin only
router.get('/cashier/:cashierId', adminOnly, getCashierSales);

export default router;
