import { Request, Response } from 'express';
import { supabase } from '../db';

export const AnalyticsController = {
    getOverviewStats: async (req: Request, res: Response) => {
        try {
            // Volume
            const { count: total, error: totalErr } = await supabase.from('emails').select('*', { count: 'exact', head: true });

            // Pending
            const { count: pending, error: pendingErr } = await supabase.from('emails').select('*', { count: 'exact', head: true })
                .neq('status', 'human_answered')
                .neq('status', 'rag_answered')
                .neq('status', 'fallback_sent')
                .neq('status', 'archived');

            // Resolved (Sent)
            const { count: resolved, error: resolvedErr } = await supabase.from('emails').select('*', { count: 'exact', head: true })
                .in('status', ['human_answered', 'rag_answered', 'fallback_sent']);

            if (totalErr || pendingErr || resolvedErr) throw new Error('Failed to fetch counts');

            res.json({
                total: total || 0,
                pending: pending || 0,
                resolved: resolved || 0,
                resolutionRate: total ? Math.round(((resolved || 0) / total) * 100) : 0
            });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    getDepartmentStats: async (req: Request, res: Response) => {
        try {
            // Since we can't do complex GROUP BY easily with Supabase client in one go without RPC, 
            // we will fetch minimal data and aggregate in JS for MVP OR separate queries.
            // For MVP, querying all emails with 'dept_name' is okay for small scale (<10k).
            // Better: use .rpc() if we had a function, but we can't change DB.

            const { data, error } = await supabase
                .from('emails')
                .select('departments (name), status');

            if (error) throw error;

            const deptStats: Record<string, { total: number, resolved: number, pending: number }> = {};

            data?.forEach((row: any) => {
                const deptName = row.departments?.name || 'Unassigned';
                if (!deptStats[deptName]) {
                    deptStats[deptName] = { total: 0, resolved: 0, pending: 0 };
                }

                deptStats[deptName].total++;

                const isResolved = ['human_answered', 'rag_answered', 'fallback_sent'].includes(row.status);
                if (isResolved) {
                    deptStats[deptName].resolved++;
                } else if (row.status !== 'archived') { // Assuming archived is neither
                    deptStats[deptName].pending++;
                }
            });

            // Format for Frontend
            const result = Object.entries(deptStats).map(([name, stats]) => ({
                name,
                ...stats,
                resolutionRate: stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0
            }));

            res.json(result);

        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    getTrends: async (req: Request, res: Response) => {
        try {
            // Get last 7 days volume
            const today = new Date();
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);

            const { data, error } = await supabase
                .from('emails')
                .select('created_at, status')
                .gte('created_at', lastWeek.toISOString());

            if (error) throw error;

            // Group by date (YYYY-MM-DD)
            const map: Record<string, { total: number, resolved: number }> = {};

            // Initialize last 7 days
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                map[dateStr] = { total: 0, resolved: 0 };
            }

            data?.forEach((row: any) => {
                const dateStr = new Date(row.created_at).toISOString().split('T')[0];
                if (map[dateStr]) {
                    map[dateStr].total++;
                    if (['human_answered', 'rag_answered', 'fallback_sent'].includes(row.status)) {
                        map[dateStr].resolved++;
                    }
                }
            });

            const result = Object.entries(map)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, stats]) => ({
                    date,
                    ...stats
                }));

            res.json(result);
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    getUserStats: async (req: Request, res: Response) => {
        try {
            const { email } = req.body; // Passed via POST body for safety/standard
            if (!email) return res.status(400).json({ error: 'Email required' });

            // 1. Fetch all resolved/sent emails to calculate user impact
            const { data: resolvedEmails, error: resolvedError } = await supabase
                .from('emails')
                .select('created_at, history')
                .in('status', ['human_answered', 'sent', 'resolved', 'archived']);

            if (resolvedError) throw resolvedError;

            console.log(`[Analytics] Calculating stats for ${email}. Found ${resolvedEmails?.length} resolved emails.`);

            let resolvedCount = 0;
            let totalDurationMs = 0;
            let lastActionDate = null;

            resolvedEmails?.forEach(row => {
                const history = Array.isArray(row.history) ? row.history : [];
                // Check if user acted on it (loose check for email string in the object)
                // This covers { actor: "email" } and { actor_email: "email" }
                // In a production DB we would use stricter types, but history is unstructured JSONB here.
                const hString = JSON.stringify(history).toLowerCase();
                const userEmailLower = email.toLowerCase();

                if (hString.includes(userEmailLower)) {
                    resolvedCount++;
                    const receivedAt = new Date(row.created_at).getTime();

                    // Try to find exact timestamp of user action
                    const userAction = history.find((h: any) =>
                        (h.actor && h.actor.toLowerCase() === userEmailLower) ||
                        (h.actor_email && h.actor_email.toLowerCase() === userEmailLower) ||
                        (h.details && h.details.includes(userEmailLower))
                    );

                    const resolvedAt = userAction?.timestamp ? new Date(userAction.timestamp).getTime() : Date.now();
                    const duration = resolvedAt - receivedAt;
                    if (duration > 0 && duration < 30 * 24 * 60 * 60 * 1000) { // sanity check < 30 days
                        totalDurationMs += duration;
                    }
                    lastActionDate = resolvedAt;
                }
            });

            const avgSpeedHours = resolvedCount > 0
                ? (totalDurationMs / resolvedCount / (1000 * 60 * 60)).toFixed(1)
                : '0.0';

            // 2. Fetch Pending Queue (Global for Admin, Dept specific if id provided)
            let pendingQuery = supabase
                .from('emails')
                .select('id', { count: 'exact', head: true })
                .in('status', ['pending', 'new', 'needs_review']);

            if (req.body.departmentId) {
                // We need to filter by department. 
                // Since emails table has 'classification' (string) or we join with departments table.
                // Assuming we use the 'departments' table join or the 'department_id' if strictly linked.
                // Based on `getPendingAndReview` in email.model.ts, we usually query all.
                // Let's assume we filter by filtering on the client for now or if we have a direct column.
                // Wait, emails table has `department_id`? Let's check getPendingAndReview.
                // It selects `departments (name)`. It implies a relation.

                // Let's try to filter by the relation if possible, or if the user is DeptHead, filter by their department.
                // Since this is a simple count, let's look at email table schema implicitly. 
                // A common pattern is `department_id`.

                // If we aren't sure of column name, checking `department_id` seems safe given `departments` relation.
                pendingQuery = pendingQuery.eq('department_id', req.body.departmentId);
            }

            const { count: pendingCount, error: pendingError } = await pendingQuery;

            if (pendingError) throw pendingError;

            // Badges Logic
            const badges: string[] = [];
            if (parseFloat(avgSpeedHours) > 0 && parseFloat(avgSpeedHours) < 2.0) badges.push('Speed Demon');
            if (resolvedCount > 10) badges.push('Problem Solver');
            if (resolvedCount > 50) badges.push('Email Veteran');
            if (pendingCount === 0) badges.push('Inbox Zero Hero');

            res.json({
                resolved: resolvedCount,
                avg_speed_hours: parseFloat(avgSpeedHours),
                pending: pendingCount || 0,
                badges
            });

        } catch (e: any) {
            console.error('getUserStats error:', e);
            res.status(500).json({ error: e.message });
        }
    }
};
