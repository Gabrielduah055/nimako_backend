import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

// Extend Express's Request to carry the decoded user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'cashier';
  };
}

// ─────────────────────────────────────────────
// protect — verify JWT and attach user to req
// ─────────────────────────────────────────────
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const decoded = jwt.verify(token, secret) as {
      id: string;
      name: string;
      email: string;
      role: 'admin' | 'cashier';
    };

    // Confirm user still exists and is active
    const user = await User.findById(decoded.id).select('-password');
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
  } catch (error: any) {
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

// ─────────────────────────────────────────────
// adminOnly — must come after protect
// ─────────────────────────────────────────────
export const adminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
    return;
  }
  next();
};
