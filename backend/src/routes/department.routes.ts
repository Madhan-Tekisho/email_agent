import { Router } from 'express';
import { DepartmentController } from '../controllers/department.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', DepartmentController.getAll);
router.get('/:id/history', DepartmentController.getHistory);
router.post('/history/stats', DepartmentController.getHistoryStats);
router.put('/:id', authenticateToken, requireRole(['SuperAdmin']), DepartmentController.updateHead);

export default router;
