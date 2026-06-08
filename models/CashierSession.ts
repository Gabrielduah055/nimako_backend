import { Schema, model, Document } from 'mongoose';

export interface ICashierSession extends Document {
  sessionId: string;
  cashierId: string;
  cashierName: string;
  openedAt: Date;
  closedAt?: Date;
  openingCash: number;
  closingCash?: number;
  status: 'open' | 'closed';
  syncStatus: 'synced' | 'pending' | 'failed';
  syncedAt?: Date;
}

const CashierSessionSchema = new Schema<ICashierSession>(
  {
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
  },
  { timestamps: true }
);

export default model<ICashierSession>('CashierSession', CashierSessionSchema);
