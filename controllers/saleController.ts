import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import Sale from '../models/Sale';
import { AuthRequest } from '../middleware/auth';
import { generateInvoiceNumber } from '../utils/invoiceGenerator';
import {
  DashboardChartPeriod,
  getPaginatedTransactions,
  getPaymentMethodBreakdown,
  getSalesChartData,
  getTopSellingProducts,
} from '../services/saleAnalyticsService';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sales
// Create a new sale (cashier or admin)
// ─────────────────────────────────────────────────────────────────────────────
export const createSale = async (req: AuthRequest, res: Response): Promise<Response> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      items,
      discountType = 'none',
      discountValue = 0,
      paymentMethod,
      cashReceived = 0,
      transferReference,
      customerName = 'Walk-in Customer',
    } = req.body;

    // ── Validate required top-level fields ───────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'items array is required and must not be empty.' });
    }

    if (!paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'paymentMethod is required.' });
    }

    // ── Validate each item & reduce stock ───────────────────────────────────
    const resolvedItems: any[] = [];
    let subtotal = 0;

    for (const item of items) {
      const { productId, quantity, unitType, unitPrice } = item;

      if (!productId || !quantity || !unitType || unitPrice === undefined) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Each item must have productId, quantity, unitType, and unitPrice.`,
        });
      }

      const product = await Product.findById(productId).session(session);

      if (!product || !product.isActive) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: `Product with id "${productId}" not found or is inactive.`,
        });
      }

      if (product.stock < quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${quantity}.`,
        });
      }

      // Reduce stock
      product.stock -= quantity;
      await product.save({ session });

      const itemTotal = parseFloat((unitPrice * quantity).toFixed(2));
      subtotal += itemTotal;

      resolvedItems.push({
        productId: product._id,
        productName: product.name,
        barcode: product.barcode,
        quantity,
        unitType,
        unitPrice,
        total: itemTotal,
      });
    }

    subtotal = parseFloat(subtotal.toFixed(2));

    // ── Calculate discount ───────────────────────────────────────────────────
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = parseFloat(((subtotal * discountValue) / 100).toFixed(2));
    } else if (discountType === 'fixed') {
      discountAmount = parseFloat(Math.min(discountValue, subtotal).toFixed(2));
    }

    const total = parseFloat((subtotal - discountAmount).toFixed(2));

    // ── Cash change ──────────────────────────────────────────────────────────
    const cashChange =
      paymentMethod === 'cash' || paymentMethod === 'mixed'
        ? parseFloat(Math.max(0, cashReceived - total).toFixed(2))
        : 0;

    // ── Generate invoice number ──────────────────────────────────────────────
    const invoiceNumber = await generateInvoiceNumber(new Date());

    // ── Save sale ────────────────────────────────────────────────────────────
    const [sale] = await Sale.create(
      [
        {
          invoiceNumber,
          items: resolvedItems,
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          total,
          paymentMethod,
          cashReceived,
          cashChange,
          transferReference: transferReference ?? undefined,
          customerName,
          cashierId: req.user!.id,
          cashierName: req.user!.name,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: 'Sale created successfully.',
      data: sale,
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    // Unique index violation on invoiceNumber (race condition edge case)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Invoice number conflict. Please retry the request.',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create sale.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/today
// Returns all sales created today + summary stats
// ─────────────────────────────────────────────────────────────────────────────
export const getTodaySales = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ createdAt: -1 });

    const totalAmount = sales.reduce((sum, s) => sum + s.total, 0);
    const totalItems  = sales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.quantity, 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalTransactions: sales.length,
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          totalItemsSold: totalItems,
          date: startOfDay.toISOString().split('T')[0],
        },
        sales,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch today\'s sales.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Admin only — date-range report with daily grouping
// ─────────────────────────────────────────────────────────────────────────────
export const getSalesByDateRange = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate query params are required (YYYY-MM-DD).' });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end   = new Date(`${endDate}T23:59:59.999Z`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    if (start > end) {
      return res.status(400).json({ success: false, message: 'startDate cannot be after endDate.' });
    }

    const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: 1 });

    // Group sales by day
    const byDay: Record<string, { transactions: number; total: number }> = {};
    for (const sale of sales) {
      const dayKey = sale.createdAt.toISOString().split('T')[0];
      if (!byDay[dayKey]) byDay[dayKey] = { transactions: 0, total: 0 };
      byDay[dayKey].transactions += 1;
      byDay[dayKey].total = parseFloat((byDay[dayKey].total + sale.total).toFixed(2));
    }

    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          startDate,
          endDate,
          totalTransactions: sales.length,
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        },
        byDay,
        sales,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to generate sales report.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/invoice/:invoiceNumber
// ─────────────────────────────────────────────────────────────────────────────
export const getSaleByInvoice = async (req: Request, res: Response): Promise<Response> => {
  try {
    const sale = await Sale.findOne({ invoiceNumber: req.params.invoiceNumber });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `No sale found with invoice number "${req.params.invoiceNumber}".`,
      });
    }

    return res.status(200).json({ success: true, data: sale });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch sale.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/cashier/:cashierId?startDate=&endDate=
// Admin only
// ─────────────────────────────────────────────────────────────────────────────
export const getCashierSales = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { cashierId } = req.params;
    const { startDate, endDate } = req.query;

    const filter: any = { cashierId };

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(`${startDate}T00:00:00.000Z`),
        $lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    const sales = await Sale.find(filter).sort({ createdAt: -1 });

    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          cashierId,
          totalTransactions: sales.length,
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        },
        sales,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch cashier sales.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/dashboard/transactions?page=1&limit=10
// Paginated transactions list — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboardTransactions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const data = await getPaginatedTransactions({ page, limit });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch transactions.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/dashboard/chart?period=7d   (today | 7d | 30d | monthly)
// Daily revenue aggregation — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const getSalesChart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const requestedPeriod = (req.query.period as DashboardChartPeriod) || '7d';
    const allowedPeriods: DashboardChartPeriod[] = ['today', '7d', '30d', 'monthly'];
    const period = allowedPeriods.includes(requestedPeriod) ? requestedPeriod : '7d';
    const data = await getSalesChartData(period);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to generate chart data.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/dashboard/top-products
// Top 5 products by quantity sold — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const getTopProducts = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const products = await getTopSellingProducts();

    return res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch top products.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/dashboard/payment-breakdown
// Revenue grouped by payment method — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const getPaymentBreakdown = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const data = await getPaymentMethodBreakdown();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch payment breakdown.' });
  }
};
