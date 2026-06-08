import { Router } from 'express';
import { protect } from '../middleware/auth';
import { getBootstrapData } from '../controllers/syncController';

const router = Router();

router.get('/bootstrap', protect, getBootstrapData);

export default router;
