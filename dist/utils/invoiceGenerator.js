"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoiceNumber = void 0;
const Sale_1 = __importDefault(require("../models/Sale"));
/**
 * Generates the next sequential invoice number for a given date.
 * Format: INV-YYYYMMDD-XXXX  (e.g. INV-20250101-0001)
 *
 * Queries the DB for the last invoice of the day and increments the counter.
 * This is called INSIDE a MongoDB transaction so duplicate invoice numbers
 * under concurrent requests are prevented by the unique index on Sale.
 */
const generateInvoiceNumber = async (date = new Date()) => {
    // Build the date prefix — e.g. "20250101"
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    const invoicePrefix = `INV-${datePrefix}-`;
    // Find the last invoice created today, sorted descending
    const lastSale = await Sale_1.default.findOne({
        invoiceNumber: { $regex: `^${invoicePrefix}` },
    })
        .sort({ invoiceNumber: -1 })
        .select('invoiceNumber')
        .lean();
    let nextCounter = 1;
    if (lastSale) {
        // Extract numeric counter from the end of the invoice number
        const parts = lastSale.invoiceNumber.split('-');
        const lastCounter = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastCounter)) {
            nextCounter = lastCounter + 1;
        }
    }
    const paddedCounter = String(nextCounter).padStart(4, '0');
    return `${invoicePrefix}${paddedCounter}`;
};
exports.generateInvoiceNumber = generateInvoiceNumber;
