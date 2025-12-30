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

// Health Check for Render
app.get('/', (req, res) => {
    res.send('Email Agent Backend is running');
});

// Routes
app.use('/api', routes);

const PORT = process.env.PORT || 4000;

// Initialize Email Service (DB Load)
emailService.init().then(() => {
    console.log("Email Service Initialized");
}).catch(err => {
    console.error("Failed to initialize Email Service:", err);
});

// Start loop

// Start loop
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
}, 10000); // Poll every 10 seconds

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
