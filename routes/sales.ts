import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth';
import {
  createSale,
  getTodaySales,
  getSalesByDateRange,
  getSaleByInvoice,
  getCashierSales,
} from '../controllers/saleController';

const router = Router();

// All sales routes require authentication
router.use(protect);

// POST   /api/sales                        → cashier or admin (create sale)
router.post('/', createSale);

// GET    /api/sales/today                  → cashier or admin
router.get('/today', getTodaySales);

// GET    /api/sales/report                 → admin only
router.get('/report', adminOnly, getSalesByDateRange);

// GET    /api/sales/invoice/:invoiceNumber → cashier or admin (receipt)
router.get('/invoice/:invoiceNumber', getSaleByInvoice);

// GET    /api/sales/cashier/:cashierId     → admin only
router.get('/cashier/:cashierId', adminOnly, getCashierSales);

export default router;
