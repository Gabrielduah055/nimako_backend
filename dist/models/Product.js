"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const ProductSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
    },
    barcode: {
        type: String,
        required: [true, 'Barcode is required'],
        unique: true,
        trim: true,
        index: true,
    },
    category: {
        type: String,
        trim: true,
        default: '',
    },
    priceSingle: {
        type: Number,
        required: [true, 'Single unit price is required'],
        default: 0,
        min: [0, 'Price cannot be negative'],
    },
    priceBulk: {
        type: Number,
        default: 0,
        min: [0, 'Bulk price cannot be negative'],
    },
    bulkQuantity: {
        type: Number,
        default: 1,
        min: [1, 'Bulk quantity must be at least 1'],
    },
    stock: {
        type: Number,
        required: [true, 'Stock quantity is required'],
        default: 0,
        min: [0, 'Stock cannot be negative'],
    },
    lowStockThreshold: {
        type: Number,
        default: 10,
        min: [0, 'Low stock threshold cannot be negative'],
    },
    unit: {
        type: String,
        default: 'piece',
        enum: {
            values: ['piece', 'carton', 'kg', 'liter'],
            message: 'Unit must be one of: piece, carton, kg, liter',
        },
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
// Compound text index for name and category search
ProductSchema.index({ name: 'text', category: 'text' });
exports.default = (0, mongoose_1.model)('Product', ProductSchema);
