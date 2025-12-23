import imaps from 'imap-simple';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { supabase } from '../db';

export class EmailService {
    private transporter: any;
    private imapConfig: any;

    constructor() {
        // Default from env (fallback)
        this.initializeTransport(process.env.GMAIL_USER || '', process.env.GMAIL_PASS || '');
    }

    async init() {
        console.log("Loading system credentials from DB...");
        const { data: userRow } = await supabase.from('system_settings').select('email_value').eq('email_key', 'GMAIL_USER').single();
        const { data: passRow } = await supabase.from('system_settings').select('email_value').eq('email_key', 'GMAIL_PASS').single();

        if (userRow && passRow) {
            console.log("Credentials found in DB. Overriding env.");
            this.updateConfig(userRow.email_value, passRow.email_value);
        } else {
            console.log("No credentials in DB. Using .env defaults.");
        }
    }

    private initializeTransport(user: string, pass: string) {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: user,
                pass: pass
            }
        });

        this.imapConfig = {
            imap: {
                user: user,
                password: pass,
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 60000,
                connTimeout: 60000,
                keepalive: false
            }
        };
    }


    updateConfig(email: string, password: string) {
        this.initializeTransport(email, password);
        console.log(`Email configuration updated for user: ${email}`);
    }

    async sendEmail(to: string, subject: string, body: string, inReplyTo?: string, cc?: string, bcc?: string) {
        console.log(`Sending email to ${to} (CC: ${cc}, BCC: ${bcc}) with subject: ${subject}`);
        const mailOptions: any = {
            from: `"[Email-agent]" <${this.imapConfig.imap.user}>`,
            to,
            subject,
            text: body,
        };

        if (cc) mailOptions.cc = cc;
        if (bcc) mailOptions.bcc = bcc;

        if (inReplyTo) {
            mailOptions.inReplyTo = inReplyTo;
            mailOptions.references = inReplyTo;
        }

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully');
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    }

    async fetchUnreadEmails() {
        console.log('Connecting to IMAP server...');
        console.log('IMAP User:', this.imapConfig.imap.user);

        try {
            const connection = await imaps.connect(this.imapConfig);
            console.log('IMAP Connected successfully');

            const box = await connection.openBox('INBOX') as any;
            console.log(`Opened INBOX. Total messages: ${box.messages?.total || 'unknown'}`);

            const searchCriteria = ['UNSEEN'];
            const fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: false // Handled manually after processing
            };

            const messages = await connection.search(searchCriteria, fetchOptions);
            console.log(`Found ${messages.length} UNSEEN messages in INBOX`);

            const emails = [];

            for (const item of messages) {
                try {
                    const id = item.attributes.uid;
                    const fullBody = item.parts.find((p: any) => p.which === "")?.body;

                    if (fullBody) {
                        const parsedMail = await simpleParser(fullBody);
                        console.log(`Parsed email UID ${id}: Subject="${parsedMail.subject}" From="${parsedMail.from?.text}"`);

                        emails.push({
                            uid: id,
                            from: parsedMail.from?.text,
                            subject: parsedMail.subject,
                            body: parsedMail.text,
                            msgId: parsedMail.messageId
                        });
                    } else {
                        console.log(`Email UID ${id}: No body found`);
                    }
                } catch (parseError) {
                    console.error(`Error parsing email:`, parseError);
                }
            }

            connection.end();
            console.log('IMAP connection closed');
            return emails;
        } catch (error: any) {
            if (error.code === 'ECONNRESET' || error.syscall === 'getaddrinfo') {
                console.warn("Network Error: Could not connect to Gmail (ECONNRESET/ENOTFOUND). Retrying in next cycle...");
            } else {
                console.error('Error fetching emails:', error.message || error);
            }
            return [];
        }
    }

    async markEmailAsSeen(uid: number) {
        try {
            const connection = await imaps.connect(this.imapConfig);
            await connection.openBox('INBOX');
            await connection.addFlags(uid, 'SEEN');
            connection.end();
            console.log(`Marked email UID ${uid} as SEEN`);
        } catch (e) {
            console.error(`Failed to mark email ${uid} as seen`, e);
        }
    }
}
