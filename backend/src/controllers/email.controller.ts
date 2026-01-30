import { Request, Response } from 'express';
import { EmailModel } from '../models/email.model';
import { EmailService } from '../services/email.service';
import { FeedbackService } from '../services/feedback.service';
import { AIService } from '../services/ai.service';

export const EmailController = {
    getPending: async (req: Request, res: Response) => {
        try {
            const emailsRes = await EmailModel.getPendingAndReview();
            const metrics = await EmailModel.getMetrics();

            res.json({
                emails: emailsRes.rows,
                metrics
            });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    approve: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { customContent } = req.body || {};
        const user = (req as any).user;
        const actor = user?.email || 'Unknown User';

        try {
            const email = await EmailModel.getByIdWithDraft(id);
            if (!email) return res.status(404).send("Email not found");

            const emailService = new EmailService();
            // Use customContent if provided (user edited), otherwise fall back to generated_reply
            const replyContent = customContent || email.generated_reply || "No reply generated";
            await emailService.sendEmail(email.from_email, "Re: " + email.subject, replyContent, undefined);

            // Update status without history (history column doesn't exist)
            await EmailModel.updateStatus(id, 'human_answered');

            // [NEW] Trigger Feedback Request
            const feedbackService = new FeedbackService();
            // Fire and forget (don't await to block response)
            feedbackService.requestFeedback(id, email.from_email, email.subject).catch(err => {
                console.error("Failed to send feedback request:", err);
            });

            res.json({ success: true });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    reject: async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = (req as any).user;
        const actor = user?.email || 'Unknown User';

        try {
            // Update status without history (history column doesn't exist)
            await EmailModel.updateStatus(id, 'archived');
            res.json({ success: true });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    batchProcess: async (req: Request, res: Response) => {
        const { emailIds, action } = req.body;
        const user = (req as any).user;
        const actor = user?.email || 'Unknown User';

        if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
            return res.status(400).json({ error: 'Invalid emailIds' });
        }

        try {
            const emailService = new EmailService();

            if (action === 'approve') {
                let successCount = 0;
                let failCount = 0;

                // Process sequentially for now to be safe, could be parallelized
                for (const id of emailIds) {
                    try {
                        const email = await EmailModel.getByIdWithDraft(id);
                        if (email && email.generated_reply) {
                            // Extract CCs if available (this logic mirrors the processor but relies on model data)
                            let ccList: string[] = [];
                            if (email.cc_email_sent_to) {
                                ccList = email.cc_email_sent_to.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                            }

                            await emailService.sendEmail(
                                email.from_email,
                                "Re: " + email.subject,
                                email.generated_reply,
                                undefined,
                                ccList.length > 0 ? ccList.join(',') : undefined
                            );

                            // Update status without history (history column doesn't exist)
                            await EmailModel.updateStatus(id, 'human_answered');

                            // [NEW] Trigger Feedback Request
                            const feedbackService = new FeedbackService();
                            feedbackService.requestFeedback(id, email.from_email, email.subject).catch(err => {
                                console.error(`Failed to send feedback request for ${id}:`, err);
                            });

                            successCount++;
                        } else {
                            failCount++;
                        }
                    } catch (e) {
                        console.error(`Failed to batch approve email ${id}`, e);
                        failCount++;
                    }
                }
                res.json({ success: true, processed: successCount, failed: failCount });

            } else if (action === 'reject') {
                // Bulk update would be better in Model, but loop is fine for MVP
                for (const id of emailIds) {
                    // Update status without history (history column doesn't exist)
                    await EmailModel.updateStatus(id, 'archived');
                }
                res.json({ success: true, processed: emailIds.length });
            } else {
                res.status(400).json({ error: 'Invalid action' });
            }
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    revertStatus: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            // Update status without history
            await EmailModel.updateStatus(id, 'needs_review');
            res.json({ success: true });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    regenerateDraft: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const email = await EmailModel.getByIdWithDraft(id);
            if (!email) return res.status(404).json({ error: "Email not found" });

            const aiService = new AIService();

            // Search for relevant context from the knowledge base
            const contextDocs = await aiService.searchContext(
                email.subject + " " + email.body_text,
                email.dept_name || 'Other'
            );

            // Generate a new reply
            const result = await aiService.generateReply(
                email.subject,
                email.body_text,
                contextDocs,
                email.dept_name || 'Other'
            );

            // Update the generated_reply in the database
            await EmailModel.updateGeneratedReply(id, result.reply, result.confidence);

            res.json({
                success: true,
                draft: result.reply,
                confidence: result.confidence
            });
        } catch (e: any) {
            console.error("Regenerate draft error:", e);
            res.status(500).json({ error: e.message });
        }
    }
};
