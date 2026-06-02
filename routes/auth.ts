import { Router } from 'express';
import { login, getMe } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

// POST /api/auth/login  → public
router.post('/login', login);

// GET  /api/auth/me     → protected (valid JWT required)
router.get('/me', protect, getMe);

export default router;
