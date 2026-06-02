import { Request, Response } from 'express';
import Product from '../models/Product';
import { parseExcelBuffer } from '../utils/excelParser';

// ─────────────────────────────────────────────
// POST /api/products/bulk-upload
// ─────────────────────────────────────────────
export const bulkUploadProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach an .xlsx or .xls file.',
      });
    }

    const products = await parseExcelBuffer(req.file.buffer);

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file contains no product rows.',
      });
    }

    let insertedCount = 0;
    let updatedCount = 0;
    const errors: any[] = [];

    for (const product of products) {
      try {
        const existing = await Product.findOne({ barcode: product.barcode });

        if (existing) {
          await Product.findOneAndUpdate(
            { barcode: product.barcode },
            { ...product, updatedAt: new Date() },
            { new: true, runValidators: true }
          );
          updatedCount++;
        } else {
          await Product.create(product);
          insertedCount++;
        }
      } catch (err: any) {
        errors.push({
          barcode: product.barcode,
          name: product.name,
          error: err.message,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Bulk upload completed.',
      data: {
        totalProcessed: products.length,
        inserted: insertedCount,
        updated: updatedCount,
        failed: errors.length,
        errors,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to process uploaded file.',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/products
// ─────────────────────────────────────────────
export const getAllProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isActive: true };

    if (typeof search === 'string' && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { barcode: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (typeof category === 'string' && category.trim()) {
      filter.category = { $regex: category.trim(), $options: 'i' };
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions: any = { [sortBy as string]: sortOrder };

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortOptions).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: pageNum * limitNum < total,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products.',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/products/:id
// ─────────────────────────────────────────────
export const getProductById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with id "${req.params.id}" not found.`,
      });
    }

    if (!product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product has been deactivated.',
      });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid product id format: "${req.params.id}".`,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch product.',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/products/barcode/:code
// ─────────────────────────────────────────────
export const getProductByBarcode = async (req: Request, res: Response): Promise<Response> => {
  try {
    const product = await Product.findOne({ barcode: req.params.code });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `No product found with barcode "${req.params.code}".`,
      });
    }

    if (!product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product has been deactivated.',
      });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch product by barcode.',
    });
  }
};

// ─────────────────────────────────────────────
// PUT /api/products/:id
// ─────────────────────────────────────────────
export const updateProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: `Product with id "${req.params.id}" not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: updatedProduct,
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid product id format: "${req.params.id}".`,
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A product with this barcode already exists.',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update product.',
    });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/products/:id (soft delete)
// ─────────────────────────────────────────────
export const deleteProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with id "${req.params.id}" not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deactivated (soft-deleted) successfully.',
      data: { id: product._id, name: product.name, isActive: product.isActive },
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid product id format: "${req.params.id}".`,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete product.',
    });
  }
};
