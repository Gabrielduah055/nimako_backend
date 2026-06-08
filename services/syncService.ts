import mongoose, { Types } from 'mongoose';
import Product from '../models/Product';
import Sale from '../models/Sale';
import CashierSession from '../models/CashierSession';

export interface SyncTransactionPayload {
  localTransactionId: string;
  invoiceNumber: string;
  sessionId?: string;
  cashierId: string;
  cashierName: string;
  subtotal: number;
  discountType?: 'percentage' | 'fixed' | 'none';
  discountValue?: number;
  discountAmount?: number;
  total: number;
  paymentMethod: 'cash' | 'transfer' | 'mixed';
  cashReceived?: number;
  cashChange?: number;
  customerName?: string;
  createdAt?: string;
  items: Array<{
    productId: string;
    productName: string;
    barcode: string;
    quantity: number;
    unitType: 'single' | 'bulk';
    unitPrice: number;
    total: number;
  }>;
}

export const syncOfflineTransaction = async (payload: SyncTransactionPayload) => {
  validateTransactionPayload(payload);

  const duplicate = await Sale.findOne({ localTransactionId: payload.localTransactionId });
  if (duplicate) {
    return { sale: duplicate, duplicate: true, stockConflict: Boolean(duplicate.stockConflict) };
  }

  if (!Types.ObjectId.isValid(payload.cashierId)) {
    throw new Error('cashierId must be a valid user id.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const resolvedItems: any[] = [];
    const stockMessages: string[] = [];

    for (const item of payload.items) {
      if (!Types.ObjectId.isValid(item.productId)) {
        throw new Error(`Invalid productId "${item.productId}".`);
      }

      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        stockMessages.push(`Product ${item.productName} was not found during sync.`);
        resolvedItems.push({
          productId: new Types.ObjectId(item.productId),
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

    const [sale] = await Sale.create(
      [
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
          cashierId: new Types.ObjectId(payload.cashierId),
          cashierName: payload.cashierName,
          syncStatus: 'synced',
          syncedAt: new Date(),
          source: 'offline-sync',
          stockConflict: stockMessages.length > 0,
          stockConflictMessage: stockMessages.join(' '),
          createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return { sale, duplicate: false, stockConflict: stockMessages.length > 0 };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const syncCashierSession = async (payload: any) => {
  if (!payload?.id || !payload.cashierId || !payload.cashierName || !payload.openedAt) {
    throw new Error('session id, cashierId, cashierName, and openedAt are required.');
  }

  const session = await CashierSession.findOneAndUpdate(
    { sessionId: payload.id },
    {
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
    },
    { upsert: true, new: true, runValidators: true }
  );

  return session;
};

const validateTransactionPayload = (payload: SyncTransactionPayload): void => {
  if (!payload) throw new Error('transaction payload is required.');
  if (!payload.localTransactionId) throw new Error('localTransactionId is required.');
  if (!payload.invoiceNumber) throw new Error('invoiceNumber is required.');
  if (!payload.cashierId || !payload.cashierName) throw new Error('cashierId and cashierName are required.');
  if (!payload.paymentMethod) throw new Error('paymentMethod is required.');
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('items array is required.');

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
