import Product from '../models/Product';

export interface LowStockQuery {
  threshold?: number;
  limit?: number;
}

export const getLowStockInventory = async ({ threshold = 5, limit = 20 }: LowStockQuery = {}) => {
  const safeThreshold = Math.max(0, threshold);
  const safeLimit = Math.min(100, Math.max(1, limit));

  const filter = {
    isActive: true,
    stock: { $lte: safeThreshold },
  };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ stock: 1, name: 1 })
      .limit(safeLimit)
      .select('name barcode category stock lowStockThreshold unit updatedAt')
      .lean(),
    Product.countDocuments(filter),
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
