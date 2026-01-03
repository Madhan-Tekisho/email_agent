import { Router } from 'express';
import { FeedbackController } from '../controllers/feedback.controller';

const router = Router();

// Public route to submit feedback
router.post('/submit', FeedbackController.submit);

// Admin route to get stats (Should be protected in prod)
router.get('/stats', FeedbackController.getStats);

export default router;
