import { Router } from 'express';
import { RagController } from '../controllers/rag.controller';

const router = Router();

router.get('/stats', RagController.getStats);

export default router;
