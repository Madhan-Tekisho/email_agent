import { Router } from 'express';
import departmentRoutes from './department.routes';
import documentRoutes from './document.routes';
import emailRoutes from './email.routes';
import systemRoutes from './system.routes';
import authRoutes from './auth.routes';
import ragRoutes from './rag.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

router.use('/departments', departmentRoutes);
router.use('/documents', documentRoutes);
router.use('/emails', emailRoutes);
router.use('/auth', authRoutes);
router.use('/system', systemRoutes);
router.use('/rag', ragRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
