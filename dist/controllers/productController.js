"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.updateProduct = exports.getProductByBarcode = exports.getProductById = exports.getAllProducts = exports.bulkUploadProducts = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const excelParser_1 = require("../utils/excelParser");
// ─────────────────────────────────────────────
// POST /api/products/bulk-upload
// ─────────────────────────────────────────────
const bulkUploadProducts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded. Please attach an .xlsx or .xls file.',
            });
        }
        const products = await (0, excelParser_1.parseExcelBuffer)(req.file.buffer);
        if (products.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'The uploaded file contains no product rows.',
            });
        }
        let insertedCount = 0;
        let updatedCount = 0;
        const errors = [];
        for (const product of products) {
            try {
                const existing = await Product_1.default.findOne({ barcode: product.barcode });
                if (existing) {
                    await Product_1.default.findOneAndUpdate({ barcode: product.barcode }, { ...product, updatedAt: new Date() }, { new: true, runValidators: true });
                    updatedCount++;
                }
                else {
                    await Product_1.default.create(product);
                    insertedCount++;
                }
            }
            catch (err) {
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
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to process uploaded file.',
        });
    }
};
exports.bulkUploadProducts = bulkUploadProducts;
// ─────────────────────────────────────────────
// GET /api/products
// ─────────────────────────────────────────────
const getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', category = '', sortBy = 'createdAt', order = 'desc', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;
        const filter = { isActive: true };
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
        const sortOptions = { [sortBy]: sortOrder };
        const [products, total] = await Promise.all([
            Product_1.default.find(filter).sort(sortOptions).skip(skip).limit(limitNum),
            Product_1.default.countDocuments(filter),
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
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch products.',
        });
    }
};
exports.getAllProducts = getAllProducts;
// ─────────────────────────────────────────────
// GET /api/products/:id
// ─────────────────────────────────────────────
const getProductById = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id);
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
    }
    catch (error) {
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
exports.getProductById = getProductById;
// ─────────────────────────────────────────────
// GET /api/products/barcode/:code
// ─────────────────────────────────────────────
const getProductByBarcode = async (req, res) => {
    try {
        const product = await Product_1.default.findOne({ barcode: req.params.code });
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
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch product by barcode.',
        });
    }
};
exports.getProductByBarcode = getProductByBarcode;
// ─────────────────────────────────────────────
// PUT /api/products/:id
// ─────────────────────────────────────────────
const updateProduct = async (req, res) => {
    try {
        const updatedProduct = await Product_1.default.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true });
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
    }
    catch (error) {
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
exports.updateProduct = updateProduct;
// ─────────────────────────────────────────────
// DELETE /api/products/:id (soft delete)
// ─────────────────────────────────────────────
const deleteProduct = async (req, res) => {
    try {
        const product = await Product_1.default.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
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
    }
    catch (error) {
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
exports.deleteProduct = deleteProduct;
