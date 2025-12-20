import { Router } from 'express';
import departmentRoutes from './department.routes';
import documentRoutes from './document.routes';
import emailRoutes from './email.routes';
import systemRoutes from './system.routes';
import authRoutes from './auth.routes';

const router = Router();

router.use('/departments', departmentRoutes);
router.use('/documents', documentRoutes);
router.use('/emails', emailRoutes);
router.use('/auth', authRoutes);
router.use('/', systemRoutes);

export default router;
