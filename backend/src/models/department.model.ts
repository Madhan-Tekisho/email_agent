import { query } from '../db';

export const DepartmentModel = {
    getAll: async () => {
        const res = await query('SELECT * FROM departments ORDER BY name');
        return res.rows;
    },

    getById: async (id: string | number) => {
        const res = await query('SELECT * FROM departments WHERE id = $1', [id]);
        return res.rows[0];
    },

    getHistory: async (deptId: string | number) => {
        // Fetch history records
        const res = await query(`
          SELECT 
              h.id, 
              h.head_name, 
              h.head_email, 
              h.start_date, 
              h.end_date,
              h.department_id,
              d.name as department_name,
              (EXTRACT(EPOCH FROM (h.end_date - h.start_date)) / 86400)::int as duration_days
          FROM public.department_head_history h
          JOIN departments d ON h.department_id = d.id
          WHERE h.department_id = $1
          ORDER BY h.end_date DESC
      `, [deptId]);
        return res.rows;
    },

    updateHead: async (id: string | number, headName: string, headEmail: string) => {
        try {
            console.log(`Updating head for dept ${id} to ${headName} (${headEmail})`);

            // 1. Get current head to archive
            const currentRes = await query('SELECT * FROM departments WHERE id = $1', [id]);
            const current = currentRes.rows[0];

            if (current) {
                console.log("Archiving current head:", current);
                // Determine start_date
                let startDate: any = new Date();
                try {
                    const lastHistoryRes = await query('SELECT end_date FROM public.department_head_history WHERE department_id = $1 ORDER BY end_date DESC LIMIT 1', [id]);
                    const lastEndDate = lastHistoryRes.rows[0]?.end_date;
                    startDate = lastEndDate || current.created_at || new Date();
                    console.log(`Archive start_date determined as: ${startDate}`);
                } catch (e: any) {
                    console.error("Failed to fetch last history:", e.message);
                }

                // Archive current
                try {
                    await query(`
                        INSERT INTO public.department_head_history (department_id, head_name, head_email, start_date, end_date)
                        VALUES ($1, $2, $3, $4, NOW())
                    `, [id, current.head_name, current.head_email, startDate]);
                    console.log("Archive successful");
                } catch (e: any) {
                    console.error("Failed to archive history:", e.message);
                    throw e; // Critical failure
                }
            } else {
                console.warn("No current department found to archive");
            }

            // 2. Update to new
            const updateRes = await query('UPDATE departments SET head_name = $1, head_email = $2 WHERE id = $3', [headName, headEmail, id]);
            console.log("Update successful");
            return updateRes;
        } catch (e) {
            console.error("Department update failed:", e);
            throw e;
        }
    },

    getHeadStats: async (headEmail: string, startDate: string, endDate: string) => {
        // Stats:
        // 1. CC'd: Emails where cc_email_sent_to contains headEmail within date range
        // 2. Pending: Emails created in range with 'needs_review' (regardless of current status? User asked for "Pending Reviews". I will count those that WERE pending or ARE pending. Actually simplest "pending reviews" usually means currently pending, but for a past person, it means "how many reviews did they have pending?". I'll assume it means "Total emails that needed review during their tenure" i.e. status='needs_review' OR 'human_answered' (implied review done))
        // Let's stick to the prompt: "number of emails that specific dept head worked on including the total emails he got both in cc ,pending reviews, resoved by him."
        // "Pending Reviews" likely means emails that went to 'needs_review' status.
        // "Resolved by him" means 'human_answered'.

        // CC Count
        const ccRes = await query(`
            SELECT COUNT(*) as count FROM emails 
            WHERE cc_email_sent_to ILIKE $1 
            AND created_at >= $2 AND created_at <= $3
        `, [`%${headEmail}%`, startDate, endDate]);

        // "Pending Reviews" (Emails that required human review during tenure)
        // We filter by status that implies review (needs_review, human_answered)
        const pendingRes = await query(`
            SELECT COUNT(*) as count FROM emails 
            WHERE (status = 'needs_review' OR status = 'human_answered')
            AND created_at >= $1 AND created_at <= $2
        `, [startDate, endDate]);

        // "Resolved by him" (Emails answered manually during tenure)
        const resolvedRes = await query(`
            SELECT COUNT(*) as count FROM emails 
            WHERE status = 'human_answered'
            AND created_at >= $1 AND created_at <= $2
            -- We ideally check who resolved it, but we lack actor ID. Assuming all human answers in this tenure associated with this head if we don't have granular logs.
        `, [startDate, endDate]);

        return {
            ccCount: parseInt(ccRes.rows[0].count),
            pendingCount: parseInt(pendingRes.rows[0].count),
            resolvedCount: parseInt(resolvedRes.rows[0].count)
        };
    }
};
