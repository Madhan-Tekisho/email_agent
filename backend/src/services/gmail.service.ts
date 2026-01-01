
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { simpleParser } from 'mailparser';

export class GmailService {
    private oauth2Client: OAuth2Client;
    private gmail: any;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            'https://developers.google.com/oauthplayground' // Redirect URL (common for refresh tokens)
        );

        this.oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });

        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * Start watching the inbox for updates.
     * This pushes notifications to the specified Pub/Sub topic.
     * Must be called periodically (e.g., daily) as it expires in 7 days.
     */
    async watch() {
        try {
            const res = await this.gmail.users.watch({
                userId: 'me',
                requestBody: {
                    labelIds: ['INBOX'],
                    topicName: process.env.PUBSUB_TOPIC_NAME,
                    labelFilterAction: 'include'
                }
            });
            console.log('Gmail Watch Active:', res.data);
            return res.data;
        } catch (error: any) {
            console.error('Error starting Gmail watch:', error.message);
            throw error;
        }
    }

    /**
     * Stop watching (optional, good for cleanup)
     */
    async stop() {
        try {
            await this.gmail.users.stop({ userId: 'me' });
            console.log('Gmail Watch Stopped');
        } catch (error) {
            console.error('Error stopping watch:', error);
        }
    }

    /**
     * Get list of changes (new messages) since the provided historyId
     */
    async fetchUpdates(startHistoryId: string) {
        try {
            const res = await this.gmail.users.history.list({
                userId: 'me',
                startHistoryId: startHistoryId,
                historyTypes: ['messageAdded']
            });

            const history = res.data.history || [];
            const newMessages: { id: string, threadId: string }[] = [];

            for (const record of history) {
                if (record.messagesAdded) {
                    for (const msg of record.messagesAdded) {
                        if (msg.message) {
                            newMessages.push({
                                id: msg.message.id!,
                                threadId: msg.message.threadId!
                            });
                        }
                    }
                }
            }

            return newMessages;
        } catch (error) {
            console.error('Error fetching history:', error);
            // If historyId is too old (404), we might need to do a full sync or ignore.
            // For now, return empty.
            return [];
        }
    }

    async fetchEmailWaitRequest(messageId: string) {
        try {
            const res = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'raw' // Get full raw content to parse manually
            });

            const rawBase64 = res.data.raw;
            if (!rawBase64) throw new Error("No raw content found");

            // Decode Base64
            const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');

            // Parse with mailparser (same as existing logic)
            const parsed = await simpleParser(decoded);

            return {
                id: messageId,
                threadId: res.data.threadId,
                snippet: res.data.snippet,
                subject: parsed.subject,
                from: parsed.from?.text,
                body: parsed.text || parsed.html || res.data.snippet || "",
                date: parsed.date,
                headers: parsed.headers,
                msgId: parsed.messageId // specific for processor compatibility
            };

        } catch (error) {
            console.error(`Error fetching email ${messageId}:`, error);
            return null;
        }
    }

    /**
     * Mark email as read by removing UNREAD label
     */
    async markAsRead(messageId: string) {
        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    removeLabelIds: ['UNREAD']
                }
            });
            console.log(`Gmail: Marked message ${messageId} as READ`);
        } catch (error) {
            console.error(`Error marking message ${messageId} as read:`, error);
        }
    }
}
