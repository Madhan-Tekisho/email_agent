import { supabase } from '../db';

export interface Feedback {
    id?: string;
    email_id: string; // Foreign Key to emails table
    rating: number; // 1-5
    comment?: string;
    token?: string; // Verification token for public access
    created_at?: string;
    status?: 'pending' | 'submitted'; // Track if feedback has been given
}

export const FeedbackModel = {
    // Create an initial feedback request entry
    createRequest: async (emailId: string | number, token: string) => {
        const { data, error } = await supabase
            .from('feedback')
            .insert({
                email_id: emailId,
                token: token,
                status: 'pending'
            })
            .select('id')
            .single();

        if (error) {
            console.error('FeedbackModel.createRequest error:', error);
            throw error;
        }
        return data;
    },

    // Submit feedback (Public)
    submit: async (token: string, rating: number, comment?: string) => {
        // First verify token and status
        const { data: request, error: findError } = await supabase
            .from('feedback')
            .select('id, email_id, status')
            .eq('token', token)
            .single();

        if (findError || !request) {
            throw new Error('Invalid or expired feedback token');
        }

        if (request.status === 'submitted') {
            throw new Error('Feedback already submitted for this link');
        }

        // Update with rating
        const { data, error } = await supabase
            .from('feedback')
            .update({
                rating,
                comment,
                status: 'submitted',
                created_at: new Date().toISOString() // Update timestamp to submission time
            })
            .eq('id', request.id)
            .select('*')
            .single();

        if (error) throw error;
        return data;
    },

    // Admin Stats
    getStats: async () => {
        const { data, error } = await supabase
            .from('feedback')
            .select('rating, comment, status, created_at, email_id, emails(subject, from_email)')
            .eq('status', 'submitted')
            .order('created_at', { ascending: false });

        if (error) return { count: 0, avg: 0 };

        const total = data.length;
        const sum = data.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        const avg = total > 0 ? (sum / total).toFixed(2) : 0;

        return {
            total_reviews: total,
            average_rating: parseFloat(avg as string),
            rows: data
        };
    },

    // Get feedback for a specific email
    getByEmailId: async (emailId: string | number) => {
        const { data, error } = await supabase
            .from('feedback')
            .select('*')
            .eq('email_id', emailId)
            .single();

        if (error && error.code !== 'PGRST116') console.error("Error fetching feedback:", error);
        return data;
    }
};
