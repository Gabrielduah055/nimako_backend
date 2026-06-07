import { Schema, model, Document, Model } from 'mongoose';

// ── Interface ─────────────────────────────────────────────────────────────────
export interface IProduct extends Document {
  name: string;
  barcode: string;
  category: string;
  priceSingle: number;
  priceBulk: number;
  bulkQuantity: number;
  stock: number;
  lowStockThreshold: number;
  unit: 'piece' | 'carton' | 'kg' | 'liter';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Instance method
  reduceStock(quantity: number): Promise<IProduct>;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const ProductSchema = new Schema<IProduct>(
  {
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
  },
  {
    timestamps: true,
  }
);

// Compound text index for name and category search
ProductSchema.index({ name: 'text', category: 'text' });
ProductSchema.index({ stock: 1, isActive: 1 });

// ── Instance method: reduceStock ─────────────────────────────────────────────
// Used by the sale controller inside MongoDB transactions.
// The session must be passed externally via product.save({ session }).
ProductSchema.methods.reduceStock = async function (quantity: number): Promise<IProduct> {
  if (this.stock < quantity) {
    throw new Error(
      `Insufficient stock for "${this.name}". Available: ${this.stock}, Requested: ${quantity}.`
    );
  }
  this.stock -= quantity;
  return this.save();
};

export default model<IProduct>('Product', ProductSchema);
