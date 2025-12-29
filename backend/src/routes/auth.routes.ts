import { Router } from 'express';
import { register, login, getCurrentUser, forgotPassword, verifyOtp, resetPassword, requestUploadOtp } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', getCurrentUser);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/request-upload-otp', requestUploadOtp);

export default router;
