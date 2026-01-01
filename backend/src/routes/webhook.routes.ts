
import { Router } from 'express';
import { handleGmailWebhook } from '../controllers/webhook.controller';

const router = Router();

// Route: POST /webhooks/gmail
// This is where Pub/Sub will push notifications
router.post('/gmail', handleGmailWebhook);

export default router;
