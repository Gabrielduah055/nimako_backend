import { Response } from 'express';
import Product from '../models/Product';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { syncCashierSession, syncOfflineTransaction } from '../services/syncService';

export const getBootstrapData = async (_req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const [products, cashiers] = await Promise.all([
      Product.find({ isActive: true }).sort({ name: 1 }),
      User.find({ role: 'cashier', isActive: true }).sort({ name: 1 }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products,
        cashiers: cashiers.map(cashier => ({
          id: cashier._id,
          name: cashier.name,
          email: cashier.email,
          role: cashier.role,
          isActive: cashier.isActive,
          updatedAt: cashier.updatedAt,
        })),
        settings: {
          currency: 'GHS',
          shopName: 'Nimako POS',
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to prepare bootstrap data.' });
  }
};

export const syncTransaction = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const payload = req.body?.transaction ?? req.body;
    const result = await syncOfflineTransaction(payload);

    return res.status(200).json({
      success: true,
      message: result.duplicate ? 'Transaction already synced.' : 'Transaction synced successfully.',
      data: {
        sale: result.sale,
        duplicate: result.duplicate,
        stockConflict: result.stockConflict,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || 'Transaction sync failed.' });
  }
};

export const syncSession = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const payload = req.body?.session ?? req.body;
    const session = await syncCashierSession(payload);

    return res.status(200).json({
      success: true,
      message: 'Cashier session synced successfully.',
      data: session,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || 'Cashier session sync failed.' });
  }
};
