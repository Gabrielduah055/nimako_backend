"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLowStockInventory = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const getLowStockInventory = async ({ threshold = 5, limit = 20 } = {}) => {
    const safeThreshold = Math.max(0, threshold);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const filter = {
        isActive: true,
        stock: { $lte: safeThreshold },
    };
    const [products, total] = await Promise.all([
        Product_1.default.find(filter)
            .sort({ stock: 1, name: 1 })
            .limit(safeLimit)
            .select('name barcode category stock lowStockThreshold unit updatedAt')
            .lean(),
        Product_1.default.countDocuments(filter),
    ]);
    return {
        products,
        threshold: safeThreshold,
        pagination: {
            total,
            page: 1,
            limit: safeLimit,
            totalPages: Math.ceil(total / safeLimit),
            hasNextPage: safeLimit < total,
            hasPrevPage: false,
        },
    };
};
exports.getLowStockInventory = getLowStockInventory;
