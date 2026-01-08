import { Router } from 'express';
import { getGoogleAuthUrl, handleGoogleCallback, login, register } from '../controllers/auth.controller';

const router = Router();

// Google OAuth
router.get('/google/url', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);

// Standard Auth (Restored)
router.post('/login', login);
router.post('/register', register);

export default router;
