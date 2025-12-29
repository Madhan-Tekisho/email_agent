import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';

const router = Router();

router.get('/overview', AnalyticsController.getOverviewStats);
router.get('/department', AnalyticsController.getDepartmentStats);
router.get('/trends', AnalyticsController.getTrends);
router.post('/user-stats', AnalyticsController.getUserStats);

export default router;
