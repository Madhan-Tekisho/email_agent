import { Router } from 'express';
import multer from 'multer';
import { DocumentController } from '../controllers/document.controller';

const upload = multer();
const router = Router();

import { authenticateToken, requireRole } from '../middleware/auth.middleware';

// Endpoint: /api/documents
router.post('/', authenticateToken, requireRole(['SuperAdmin', 'Admin', 'DeptHead']), upload.single('file'), DocumentController.upload);
router.get('/', DocumentController.list);
router.get('/:id/content', DocumentController.getContent);
router.patch('/:id/reassign', DocumentController.reassign);

export default router;
