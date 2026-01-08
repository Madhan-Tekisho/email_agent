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
import authRoutes from './routes/auth.routes';
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 4000;

// Initialize Email Service (DB Load)
emailService.init().then(() => {
    console.log("Email Service Initialized");
}).catch(err => {
    console.error("Failed to initialize Email Service:", err);
});

// Initialize Gmail Watch (if configured)
// Initialize Gmail Watch
// Initialize Gmail Watch
import { gmailService } from './services/gmail.service';

const startServer = async () => {
    try {
        await gmailService.loadCredentials();
        await gmailService.watch();
    } catch (err: any) {
        console.error("Gmail Service Startup Error:", err.message);
    }

    /* 
    // POLLING DISABLED - Relying on Gmail Push Notifications (Webhooks)
    ...
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
};

startServer();
