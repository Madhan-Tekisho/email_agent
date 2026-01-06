
import { Request, Response } from 'express';
import { GmailService } from '../services/gmail.service';
import { processSingleEmail } from '../services/processor'; // We will create this export next

const gmailService = new GmailService();

export const handleGmailWebhook = async (req: Request, res: Response) => {
    try {
        console.log("Webhook received from Pub/Sub");

        // 1. Validation (Verify token usually passed as query param or header if configured in Pub/Sub)
        const secret = req.query.secret;
        if (secret !== process.env.GMAIL_WEBHOOK_SECRET) {
            console.warn("Invalid webhook secret");
            // Return 403? Or 200 to stop Pub/Sub from retrying forever?
            // Usually 200 to ack, but log security warning. 
            // Here we return 401 to be strict for now.
            return res.status(401).send('Invalid secret');
        }

        // 2. Parse Pub/Sub Message
        // Google Pub/Sub sends a body like: { message: { data: "base64...", messageId: "..." } }
        if (!req.body || !req.body.message) {
            return res.status(400).send('Bad Request: Missing message');
        }

        const dataBase64 = req.body.message.data;
        const dataJson = Buffer.from(dataBase64, 'base64').toString('utf-8');
        const notification = JSON.parse(dataJson);

        console.log("Notification Payload:", notification);

        // Payload format: { emailAddress: '...', historyId: 12345 }
        const { emailAddress, historyId } = notification;

        if (!historyId) {
            console.log("No historyId found in notification.");
            return res.status(200).send('Ack');
        }

        // 3. Process Async (Don't hold the connection)
        // Pub/Sub expects a quick 200 OK.
        res.status(200).send('Ack');

        // Fire and forget logic
        (async () => {
            try {
                // Reverting to fetchUnreadMessages for reliability.
                // processor.ts handles deduplication, so this is safe.
                const messageIds = await gmailService.fetchUnreadMessages();

                console.log(`Webhook triggered scan: Found ${messageIds.length} UNREAD messages.`);

                for (const msg of messageIds) {
                    if (!msg.id) continue;

                    // Fetch full content
                    const fullEmail = await gmailService.fetchEmailWaitRequest(msg.id);
                    if (fullEmail) {
                        // Pass to the main processor logic
                        await processSingleEmail(fullEmail);
                    }
                }
            } catch (err) {
                console.error("Error processing webhook background task:", err);
            }
        })();

    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send('Internal Server Error');
    }
};
