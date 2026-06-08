"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncSession = exports.syncTransaction = exports.getBootstrapData = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const User_1 = __importDefault(require("../models/User"));
const syncService_1 = require("../services/syncService");
const getBootstrapData = async (_req, res) => {
    try {
        const [products, cashiers] = await Promise.all([
            Product_1.default.find({ isActive: true }).sort({ name: 1 }),
            User_1.default.find({ role: 'cashier', isActive: true }).sort({ name: 1 }),
        ]);
        return res.status(200).json({
            success: true,
            data: {
                products,
                cashiers: cashiers.map(cashier => ({
                    id: cashier._id,
                    name: cashier.name,
                    email: cashier.email,
                    role: cashier.role,
                    isActive: cashier.isActive,
                    updatedAt: cashier.updatedAt,
                })),
                settings: {
                    currency: 'GHS',
                    shopName: 'Nimako POS',
                },
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to prepare bootstrap data.' });
    }
};
exports.getBootstrapData = getBootstrapData;
const syncTransaction = async (req, res) => {
    try {
        const payload = req.body?.transaction ?? req.body;
        const result = await (0, syncService_1.syncOfflineTransaction)(payload);
        return res.status(200).json({
            success: true,
            message: result.duplicate ? 'Transaction already synced.' : 'Transaction synced successfully.',
            data: {
                sale: result.sale,
                duplicate: result.duplicate,
                stockConflict: result.stockConflict,
            },
        });
    }
    catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'Transaction sync failed.' });
    }
};
exports.syncTransaction = syncTransaction;
const syncSession = async (req, res) => {
    try {
        const payload = req.body?.session ?? req.body;
        const session = await (0, syncService_1.syncCashierSession)(payload);
        return res.status(200).json({
            success: true,
            message: 'Cashier session synced successfully.',
            data: session,
        });
    }
    catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'Cashier session sync failed.' });
    }
};
exports.syncSession = syncSession;
