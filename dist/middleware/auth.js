"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOnly = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
// ─────────────────────────────────────────────
// protect — verify JWT and attach user to req
// ─────────────────────────────────────────────
const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
            });
            return;
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            res.status(500).json({
                success: false,
                message: 'Server configuration error: JWT_SECRET missing.',
            });
            return;
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // Confirm user still exists and is active
        const user = await User_1.default.findById(decoded.id).select('-password');
        if (!user || !user.isActive) {
            res.status(401).json({
                success: false,
                message: 'User no longer exists or has been deactivated.',
            });
            return;
        }
        req.user = {
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role,
        };
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
            return;
        }
        if (error.name === 'JsonWebTokenError') {
            res.status(401).json({ success: false, message: 'Invalid token.' });
            return;
        }
        res.status(500).json({ success: false, message: error.message || 'Authentication error.' });
    }
};
exports.protect = protect;
// ─────────────────────────────────────────────
// adminOnly — must come after protect
// ─────────────────────────────────────────────
const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.',
        });
        return;
    }
    next();
};
exports.adminOnly = adminOnly;
