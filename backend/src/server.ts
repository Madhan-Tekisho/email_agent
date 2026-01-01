import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { processEmails, emailService } from './services/processor';
import { checkSLA } from './services/sla.service';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);
import webhookRoutes from './routes/webhook.routes';
app.use('/webhooks', webhookRoutes);

const PORT = process.env.PORT || 4000;

// Initialize Email Service (DB Load)
emailService.init().then(() => {
    console.log("Email Service Initialized");
}).catch(err => {
    console.error("Failed to initialize Email Service:", err);
});

// Initialize Gmail Watch (if configured)
import { GmailService } from './services/gmail.service';
if (process.env.GOOGLE_REFRESH_TOKEN && process.env.PUBSUB_TOPIC_NAME) {
    const gmailService = new GmailService();
    gmailService.watch().catch(err => console.error("Failed to start Gmail Watch:", err.message));
} else {
    console.log("Gmail Webhooks skipped (GOOGLE_REFRESH_TOKEN or PUBSUB_TOPIC_NAME missing)");
}

/* 
// POLLING DISABLED - Relying on Gmail Push Notifications (Webhooks)
let isProcessing = false;

setInterval(async () => {
    if (isProcessing) {
        console.log("Previous poll still processing. Skipping...");
        return;
    }

    isProcessing = true;
    console.log("Auto-processing...");
    try {
        await processEmails();
        await checkSLA();
    } catch (e) {
        console.error("Auto-process failed:", e);
    } finally {
        isProcessing = false;
    }
    console.log("Next poll in 10 seconds...");
}, 10000); 
*/
console.log("IMAP Polling is DISABLED. Waiting for Webhook events...");

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
    console.log('Received kill signal, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
