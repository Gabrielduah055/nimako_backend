"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const SaleItemSchema = new mongoose_1.Schema({
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    productName: { type: String, required: true },
    barcode: { type: String, required: true },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
    unitType: {
        type: String,
        enum: { values: ['single', 'bulk'], message: 'unitType must be single or bulk' },
        required: true,
    },
    unitPrice: { type: Number, required: true, min: [0, 'Unit price cannot be negative'] },
    total: { type: Number, required: true, min: [0, 'Item total cannot be negative'] },
}, { _id: false });
const SaleSchema = new mongoose_1.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    items: {
        type: [SaleItemSchema],
        required: true,
        validate: {
            validator: (items) => items.length > 0,
            message: 'A sale must contain at least one item.',
        },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed', 'none'],
        default: 'none',
    },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
        type: String,
        enum: { values: ['cash', 'transfer', 'mobile_money', 'card', 'mixed'], message: 'Invalid payment method' },
        required: true,
    },
    cashReceived: { type: Number, default: 0, min: 0 },
    cashChange: { type: Number, default: 0, min: 0 },
    transferReference: { type: String, trim: true },
    customerName: { type: String, default: 'Walk-in Customer', trim: true },
    cashierId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    cashierName: { type: String, required: true },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Index for date-range queries
SaleSchema.index({ createdAt: -1 });
// Index for payment breakdown aggregation
SaleSchema.index({ paymentMethod: 1 });
// Compound index for cashier reports
SaleSchema.index({ cashierId: 1, createdAt: -1 });
exports.default = (0, mongoose_1.model)('Sale', SaleSchema);
