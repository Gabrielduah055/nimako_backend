import { Router } from 'express';
import { protect } from '../middleware/auth';
import { syncSession } from '../controllers/syncController';

const router = Router();

router.post('/sync', protect, syncSession);

export default router;
