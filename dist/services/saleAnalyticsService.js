"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentMethodBreakdown = exports.getTopSellingProducts = exports.getSalesChartData = exports.getPaginatedTransactions = void 0;
const Sale_1 = __importDefault(require("../models/Sale"));
const GHANA_TIMEZONE = 'Africa/Accra';
const getPaginatedTransactions = async ({ page, limit }) => {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;
    const [transactions, total] = await Promise.all([
        Sale_1.default.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .select('invoiceNumber cashierName customerName total paymentMethod items createdAt')
            .lean(),
        Sale_1.default.countDocuments({}),
    ]);
    const totalPages = Math.ceil(total / safeLimit);
    return {
        transactions,
        pagination: {
            total,
            page: safePage,
            limit: safeLimit,
            totalPages,
            hasNextPage: safePage < totalPages,
            hasPrevPage: safePage > 1,
        },
    };
};
exports.getPaginatedTransactions = getPaginatedTransactions;
const startOfLocalDay = (date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
};
const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
};
const monthKey = (year, monthIndex) => {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
};
const dayKey = (date) => date.toISOString().slice(0, 10);
const buildExpectedLabels = (period, now) => {
    if (period === 'today') {
        const currentHour = now.getHours();
        return Array.from({ length: currentHour + 1 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
    }
    if (period === 'monthly') {
        return Array.from({ length: now.getMonth() + 1 }, (_, index) => monthKey(now.getFullYear(), index));
    }
    const days = period === '30d' ? 30 : 7;
    const start = addDays(startOfLocalDay(now), -(days - 1));
    return Array.from({ length: days }, (_, index) => dayKey(addDays(start, index)));
};
const getChartStartDate = (period, now) => {
    if (period === 'today')
        return startOfLocalDay(now);
    if (period === '30d')
        return addDays(startOfLocalDay(now), -29);
    if (period === 'monthly')
        return new Date(now.getFullYear(), 0, 1);
    return addDays(startOfLocalDay(now), -6);
};
const getGroupFormat = (period) => {
    if (period === 'today')
        return '%H:00';
    if (period === 'monthly')
        return '%Y-%m';
    return '%Y-%m-%d';
};
const getSalesChartData = async (period) => {
    const now = new Date();
    const start = getChartStartDate(period, now);
    const groupFormat = getGroupFormat(period);
    const buckets = await Sale_1.default.aggregate([
        { $match: { createdAt: { $gte: start, $lte: now } } },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: groupFormat,
                        date: '$createdAt',
                        timezone: GHANA_TIMEZONE,
                    },
                },
                revenue: { $sum: '$total' },
                transactions: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
        {
            $project: {
                _id: 0,
                label: '$_id',
                revenue: { $round: ['$revenue', 2] },
                transactions: 1,
            },
        },
    ]);
    const bucketMap = new Map(buckets.map((bucket) => [
        bucket.label,
        {
            revenue: Number(bucket.revenue) || 0,
            transactions: Number(bucket.transactions) || 0,
        },
    ]));
    const labels = buildExpectedLabels(period, now);
    const revenue = labels.map((label) => Number((bucketMap.get(label)?.revenue ?? 0).toFixed(2)));
    const transactions = labels.map((label) => bucketMap.get(label)?.transactions ?? 0);
    return {
        period,
        labels,
        revenue,
        transactions,
    };
};
exports.getSalesChartData = getSalesChartData;
const getTopSellingProducts = async () => {
    return Sale_1.default.aggregate([
        { $unwind: '$items' },
        {
            $group: {
                _id: {
                    productId: '$items.productId',
                    productName: '$items.productName',
                },
                productName: { $first: '$items.productName' },
                quantitySold: { $sum: '$items.quantity' },
                revenueGenerated: { $sum: '$items.total' },
            },
        },
        { $sort: { quantitySold: -1, revenueGenerated: -1 } },
        { $limit: 5 },
        {
            $project: {
                _id: 0,
                productId: '$_id.productId',
                productName: 1,
                quantitySold: 1,
                revenueGenerated: { $round: ['$revenueGenerated', 2] },
                totalQty: '$quantitySold',
                totalRev: { $round: ['$revenueGenerated', 2] },
            },
        },
    ]);
};
exports.getTopSellingProducts = getTopSellingProducts;
const getPaymentMethodBreakdown = async () => {
    const buckets = await Sale_1.default.aggregate([
        {
            $group: {
                _id: '$paymentMethod',
                revenue: { $sum: '$total' },
                count: { $sum: 1 },
            },
        },
        { $sort: { revenue: -1 } },
    ]);
    const totalRevenue = buckets.reduce((sum, bucket) => sum + bucket.revenue, 0);
    const breakdown = buckets.map((bucket) => ({
        method: bucket._id,
        revenue: parseFloat(bucket.revenue.toFixed(2)),
        count: bucket.count,
        percentage: totalRevenue > 0 ? parseFloat(((bucket.revenue / totalRevenue) * 100).toFixed(1)) : 0,
    }));
    return {
        breakdown,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    };
};
exports.getPaymentMethodBreakdown = getPaymentMethodBreakdown;
