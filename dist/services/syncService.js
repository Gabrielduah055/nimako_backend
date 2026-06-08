"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCashierSession = exports.syncOfflineTransaction = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const Product_1 = __importDefault(require("../models/Product"));
const Sale_1 = __importDefault(require("../models/Sale"));
const CashierSession_1 = __importDefault(require("../models/CashierSession"));
const syncOfflineTransaction = async (payload) => {
    validateTransactionPayload(payload);
    const duplicate = await Sale_1.default.findOne({ localTransactionId: payload.localTransactionId });
    if (duplicate) {
        return { sale: duplicate, duplicate: true, stockConflict: Boolean(duplicate.stockConflict) };
    }
    if (!mongoose_1.Types.ObjectId.isValid(payload.cashierId)) {
        throw new Error('cashierId must be a valid user id.');
    }
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const resolvedItems = [];
        const stockMessages = [];
        for (const item of payload.items) {
            if (!mongoose_1.Types.ObjectId.isValid(item.productId)) {
                throw new Error(`Invalid productId "${item.productId}".`);
            }
            const product = await Product_1.default.findById(item.productId).session(session);
            if (!product) {
                stockMessages.push(`Product ${item.productName} was not found during sync.`);
                resolvedItems.push({
                    productId: new mongoose_1.Types.ObjectId(item.productId),
                    productName: item.productName,
                    barcode: item.barcode,
                    quantity: item.quantity,
                    unitType: item.unitType,
                    unitPrice: item.unitPrice,
                    total: item.total,
                });
                continue;
            }
            if (product.stock < item.quantity) {
                stockMessages.push(`${product.name} stock went below zero during offline sync.`);
            }
            product.stock -= item.quantity;
            await product.save({ session, validateBeforeSave: false });
            resolvedItems.push({
                productId: product._id,
                productName: product.name,
                barcode: product.barcode,
                quantity: item.quantity,
                unitType: item.unitType,
                unitPrice: item.unitPrice,
                total: item.total,
            });
        }
        const [sale] = await Sale_1.default.create([
            {
                localTransactionId: payload.localTransactionId,
                invoiceNumber: payload.invoiceNumber,
                sessionId: payload.sessionId,
                items: resolvedItems,
                subtotal: payload.subtotal,
                discountType: payload.discountType ?? 'none',
                discountValue: payload.discountValue ?? 0,
                discountAmount: payload.discountAmount ?? 0,
                total: payload.total,
                paymentMethod: payload.paymentMethod,
                cashReceived: payload.cashReceived ?? 0,
                cashChange: payload.cashChange ?? 0,
                customerName: payload.customerName ?? 'Walk-in Customer',
                cashierId: new mongoose_1.Types.ObjectId(payload.cashierId),
                cashierName: payload.cashierName,
                syncStatus: 'synced',
                syncedAt: new Date(),
                source: 'offline-sync',
                stockConflict: stockMessages.length > 0,
                stockConflictMessage: stockMessages.join(' '),
                createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
            },
        ], { session });
        await session.commitTransaction();
        return { sale, duplicate: false, stockConflict: stockMessages.length > 0 };
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
};
exports.syncOfflineTransaction = syncOfflineTransaction;
const syncCashierSession = async (payload) => {
    if (!payload?.id || !payload.cashierId || !payload.cashierName || !payload.openedAt) {
        throw new Error('session id, cashierId, cashierName, and openedAt are required.');
    }
    const session = await CashierSession_1.default.findOneAndUpdate({ sessionId: payload.id }, {
        sessionId: payload.id,
        cashierId: payload.cashierId,
        cashierName: payload.cashierName,
        openedAt: new Date(payload.openedAt),
        closedAt: payload.closedAt ? new Date(payload.closedAt) : undefined,
        openingCash: Number(payload.openingCash) || 0,
        closingCash: payload.closingCash === undefined ? undefined : Number(payload.closingCash),
        status: payload.status ?? 'open',
        syncStatus: 'synced',
        syncedAt: new Date(),
    }, { upsert: true, new: true, runValidators: true });
    return session;
};
exports.syncCashierSession = syncCashierSession;
const validateTransactionPayload = (payload) => {
    if (!payload)
        throw new Error('transaction payload is required.');
    if (!payload.localTransactionId)
        throw new Error('localTransactionId is required.');
    if (!payload.invoiceNumber)
        throw new Error('invoiceNumber is required.');
    if (!payload.cashierId || !payload.cashierName)
        throw new Error('cashierId and cashierName are required.');
    if (!payload.paymentMethod)
        throw new Error('paymentMethod is required.');
    if (!Array.isArray(payload.items) || payload.items.length === 0)
        throw new Error('items array is required.');
    for (const item of payload.items) {
        if (!item.productId || !item.productName || !item.barcode) {
            throw new Error('Each item requires productId, productName, and barcode.');
        }
        if (!item.quantity || item.quantity <= 0) {
            throw new Error('Each item quantity must be greater than zero.');
        }
        if (item.unitPrice === undefined || item.total === undefined) {
            throw new Error('Each item requires unitPrice and total.');
        }
    }
};
