import { Request, Response } from 'express';
import { FeedbackService } from '../services/feedback.service';

const feedbackService = new FeedbackService();

export const FeedbackController = {

    // PUBLIC: Submit feedback
    submit: async (req: Request, res: Response) => {
        try {
            const { token, rating, comment } = req.body;

            if (!token || !rating) {
                return res.status(400).json({ error: 'Token and rating are required' });
            }

            const result = await feedbackService.submitFeedback(token, Number(rating), comment);
            return res.json({ success: true, message: 'Feedback submitted successfully', data: result });

        } catch (error: any) {
            console.error('Feedback submit error:', error);
            return res.status(400).json({ error: error.message || 'Failed to submit feedback' });
        }
    },

    // ADMIN: Get stats
    getStats: async (req: Request, res: Response) => {
        try {
            const stats = await feedbackService.getStats();
            return res.json(stats);
        } catch (error) {
            console.error('Feedback stats error:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};
