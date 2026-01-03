import { Router } from 'express';
import authRoutes from './auth.routes';
import categoryRoutes from './department.routes';
import systemRoutes from './system.routes';
import documentRoutes from './document.routes';
import analyticsRoutes from './analytics.routes';
import ragRoutes from './rag.routes';
import emailRoutes from './email.routes';
import webhookRoutes from './webhook.routes';
import feedbackRoutes from './feedback.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/departments', categoryRoutes);
router.use('/system', systemRoutes);
router.use('/documents', documentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/rag', ragRoutes);
router.use('/emails', emailRoutes);
router.use('/webhook', webhookRoutes);
router.use('/feedback', feedbackRoutes); // [NEW] Feedback routes

export default router;
