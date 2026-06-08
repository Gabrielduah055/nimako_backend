import { Router } from 'express';
import { protect } from '../middleware/auth';
import { syncTransaction } from '../controllers/syncController';

const router = Router();

router.post('/sync', protect, syncTransaction);

export default router;
