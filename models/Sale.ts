import { Schema, model, Document, Types } from 'mongoose';

// ── Sale Item ─────────────────────────────────────────────────────────────────
export interface ISaleItem {
  productId: Types.ObjectId;
  productName: string;
  barcode: string;
  quantity: number;
  unitType: 'single' | 'bulk';
  unitPrice: number;
  total: number;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
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
  },
  { _id: false }
);

// ── Sale ──────────────────────────────────────────────────────────────────────
export interface ISale extends Document {
  invoiceNumber: string;
  items: ISaleItem[];
  subtotal: number;
  discountType: 'percentage' | 'fixed' | 'none';
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'cash' | 'transfer' | 'mixed';
  cashReceived: number;
  cashChange: number;
  transferReference?: string;
  customerName: string;
  cashierId: Types.ObjectId;
  cashierName: string;
  createdAt: Date;
}

const SaleSchema = new Schema<ISale>(
  {
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
        validator: (items: ISaleItem[]) => items.length > 0,
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
      enum: { values: ['cash', 'transfer', 'mixed'], message: 'Invalid payment method' },
      required: true,
    },
    cashReceived: { type: Number, default: 0, min: 0 },
    cashChange: { type: Number, default: 0, min: 0 },
    transferReference: { type: String, trim: true },
    customerName: { type: String, default: 'Walk-in Customer', trim: true },
    cashierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cashierName: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for date-range queries
SaleSchema.index({ createdAt: -1 });

export default model<ISale>('Sale', SaleSchema);
