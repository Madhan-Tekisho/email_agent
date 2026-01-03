import { FeedbackModel } from '../models/feedback.model';
import { EmailService } from './email.service';
import crypto from 'crypto';

const emailService = new EmailService();

export class FeedbackService {

    // Generate token and send request email
    async requestFeedback(emailId: string | number, userEmail: string, emailSubject: string) {
        try {
            // 1. Generate unique token
            const token = crypto.randomBytes(32).toString('hex');

            // 2. Create DB entry
            await FeedbackModel.createRequest(emailId, token);

            // 3. Construct Feedback Link (Assuming frontend URL)
            // TODO: Replace with actual frontend URL or API handling
            const feedbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/feedback?token=${token}`;

            // 4. Send Email
            const subject = `How did we do? Feedback for "${emailSubject}"`;
            const body = `
Hi,

We recently resolved your query: "${emailSubject}".

We'd love to hear your thoughts on how we handled it. It will only take a minute.

Rate us here: ${feedbackUrl}

Thank you,
Support Team
            `;

            await emailService.sendEmail(userEmail, subject, body);
            console.log(`Feedback request sent to ${userEmail} for email ID ${emailId}`);
            return true;

        } catch (error) {
            console.error('Error in requestFeedback:', error);
            return false;
        }
    }

    async submitFeedback(token: string, rating: number, comment?: string) {
        if (rating < 1 || rating > 5) {
            throw new Error("Rating must be between 1 and 5");
        }
        return await FeedbackModel.submit(token, rating, comment);
    }

    async getStats() {
        return await FeedbackModel.getStats();
    }
}
