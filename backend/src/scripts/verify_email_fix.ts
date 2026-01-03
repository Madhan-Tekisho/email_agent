
import { GmailService } from '../services/gmail.service';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const run = async () => {
    console.log("Starting verification of Gmail Logic...");

    try {
        const gmail = new GmailService();
        console.log("Gmail Service initialized.");

        console.log("Fetching unread messages (direct method)...");
        const messages = await gmail.fetchUnreadMessages();

        console.log(`Success! Found ${messages.length} unread messages.`);
        messages.forEach((msg: any) => {
            console.log(`- ID: ${msg.id}, ThreadId: ${msg.threadId}`);
        });

    } catch (error) {
        console.error("Verification failed:", error);
    }
};

run();
