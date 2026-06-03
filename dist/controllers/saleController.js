"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCashierSales = exports.getSaleByInvoice = exports.getSalesByDateRange = exports.getTodaySales = exports.createSale = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = __importDefault(require("../models/Product"));
const Sale_1 = __importDefault(require("../models/Sale"));
const invoiceGenerator_1 = require("../utils/invoiceGenerator");
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sales
// Create a new sale (cashier or admin)
// ─────────────────────────────────────────────────────────────────────────────
const createSale = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { items, discountType = 'none', discountValue = 0, paymentMethod, cashReceived = 0, transferReference, customerName = 'Walk-in Customer', } = req.body;
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
        const resolvedItems = [];
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
            const product = await Product_1.default.findById(productId).session(session);
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
        }
        else if (discountType === 'fixed') {
            discountAmount = parseFloat(Math.min(discountValue, subtotal).toFixed(2));
        }
        const total = parseFloat((subtotal - discountAmount).toFixed(2));
        // ── Cash change ──────────────────────────────────────────────────────────
        const cashChange = paymentMethod === 'cash' || paymentMethod === 'mixed'
            ? parseFloat(Math.max(0, cashReceived - total).toFixed(2))
            : 0;
        // ── Generate invoice number ──────────────────────────────────────────────
        const invoiceNumber = await (0, invoiceGenerator_1.generateInvoiceNumber)(new Date());
        // ── Save sale ────────────────────────────────────────────────────────────
        const [sale] = await Sale_1.default.create([
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
                cashierId: req.user.id,
                cashierName: req.user.name,
            },
        ], { session });
        await session.commitTransaction();
        session.endSession();
        return res.status(201).json({
            success: true,
            message: 'Sale created successfully.',
            data: sale,
        });
    }
    catch (error) {
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
exports.createSale = createSale;
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/today
// Returns all sales created today + summary stats
// ─────────────────────────────────────────────────────────────────────────────
const getTodaySales = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const sales = await Sale_1.default.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        }).sort({ createdAt: -1 });
        const totalAmount = sales.reduce((sum, s) => sum + s.total, 0);
        const totalItems = sales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.quantity, 0), 0);
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
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch today\'s sales.' });
    }
};
exports.getTodaySales = getTodaySales;
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Admin only — date-range report with daily grouping
// ─────────────────────────────────────────────────────────────────────────────
const getSalesByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'startDate and endDate query params are required (YYYY-MM-DD).' });
        }
        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T23:59:59.999Z`);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
        }
        if (start > end) {
            return res.status(400).json({ success: false, message: 'startDate cannot be after endDate.' });
        }
        const sales = await Sale_1.default.find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: 1 });
        // Group sales by day
        const byDay = {};
        for (const sale of sales) {
            const dayKey = sale.createdAt.toISOString().split('T')[0];
            if (!byDay[dayKey])
                byDay[dayKey] = { transactions: 0, total: 0 };
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
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to generate sales report.' });
    }
};
exports.getSalesByDateRange = getSalesByDateRange;
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/invoice/:invoiceNumber
// ─────────────────────────────────────────────────────────────────────────────
const getSaleByInvoice = async (req, res) => {
    try {
        const sale = await Sale_1.default.findOne({ invoiceNumber: req.params.invoiceNumber });
        if (!sale) {
            return res.status(404).json({
                success: false,
                message: `No sale found with invoice number "${req.params.invoiceNumber}".`,
            });
        }
        return res.status(200).json({ success: true, data: sale });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch sale.' });
    }
};
exports.getSaleByInvoice = getSaleByInvoice;
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/cashier/:cashierId?startDate=&endDate=
// Admin only
// ─────────────────────────────────────────────────────────────────────────────
const getCashierSales = async (req, res) => {
    try {
        const { cashierId } = req.params;
        const { startDate, endDate } = req.query;
        const filter = { cashierId };
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`),
            };
        }
        const sales = await Sale_1.default.find(filter).sort({ createdAt: -1 });
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
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch cashier sales.' });
    }
};
exports.getCashierSales = getCashierSales;
