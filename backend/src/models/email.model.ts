import { supabase } from '../db';

export const EmailModel = {
    getPendingAndReview: async () => {
        const { data, error } = await supabase
            .from('emails')
            .select(`
                id, subject, status, confidence_score, body_text, generated_reply, 
                from_email, created_at, priority, intent, token_used, cc_email_sent_to,
                departments (name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('getPendingAndReview error:', error);
            throw error;
        }

        // Transform to match original format
        return {
            rows: data?.map(row => ({
                ...row,
                confidence: row.confidence_score,
                dept_name: (row.departments as any)?.name || null,
                cc: row.cc_email_sent_to ? row.cc_email_sent_to.split(',') : []
            })) || []
        };
    },

    getMetrics: async () => {
        // Total emails count
        const { count: total, error: totalError } = await supabase
            .from('emails')
            .select('*', { count: 'exact', head: true });

        // Queue count (needs_review)
        const { count: queue, error: queueError } = await supabase
            .from('emails')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'needs_review');

        // Sent count
        const { count: sent, error: sentError } = await supabase
            .from('emails')
            .select('*', { count: 'exact', head: true })
            .in('status', ['human_answered', 'rag_answered', 'fallback_sent']);

        // Average confidence
        const { data: confData, error: confError } = await supabase
            .from('emails')
            .select('confidence_score');

        // Total tokens
        const { data: tokenData, error: tokenError } = await supabase
            .from('emails')
            .select('token_used');

        const avgConfidence = confData?.length
            ? confData.reduce((sum, row) => sum + (parseFloat(row.confidence_score) || 0), 0) / confData.length
            : 0;

        const totalTokens = tokenData?.reduce((sum, row) => sum + (parseInt(row.token_used) || 0), 0) || 0;

        return {
            total: total || 0,
            queue: queue || 0,
            sent: sent || 0,
            avgConfidence,
            totalTokens
        };
    },

    getByIdWithDraft: async (id: string | number) => {
        const { data, error } = await supabase
            .from('emails')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('getByIdWithDraft error:', error);
            return null;
        }

        return data;
    },

    updateStatus: async (id: string | number, status: string) => {
        const { data, error } = await supabase
            .from('emails')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error('updateStatus error:', error);
            throw error;
        }

        return { rows: data || [], rowCount: 1 };
    },

    updateStatusAndHistory: async (id: string | number, status: string, historyItem: any) => {
        // First get current history
        const { data: current, error: getError } = await supabase
            .from('emails')
            .select('history')
            .eq('id', id)
            .single();

        if (getError) throw getError;

        const history = Array.isArray(current.history) ? current.history : [];
        history.push(historyItem);

        const { data, error } = await supabase
            .from('emails')
            .update({ status, history })
            .eq('id', id);

        if (error) {
            console.error('updateStatusAndHistory error:', error);
            throw error;
        }

        return { rows: data || [], rowCount: 1 };
    }
};
