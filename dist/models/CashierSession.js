"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const CashierSessionSchema = new mongoose_1.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    cashierId: { type: String, required: true, index: true },
    cashierName: { type: String, required: true },
    openedAt: { type: Date, required: true },
    closedAt: { type: Date },
    openingCash: { type: Number, default: 0, min: 0 },
    closingCash: { type: Number, min: 0 },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    syncStatus: { type: String, enum: ['synced', 'pending', 'failed'], default: 'synced', index: true },
    syncedAt: { type: Date },
}, { timestamps: true });
exports.default = (0, mongoose_1.model)('CashierSession', CashierSessionSchema);
