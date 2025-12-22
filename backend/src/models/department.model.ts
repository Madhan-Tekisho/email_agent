import { supabase } from '../db';

export const DepartmentModel = {
    getAll: async () => {
        const { data, error } = await supabase
            .from('departments')
            .select('*')
            .order('name');

        if (error) {
            console.error('DepartmentModel.getAll error:', error);
            throw error;
        }

        return data || [];
    },

    getById: async (id: string | number) => {
        const { data, error } = await supabase
            .from('departments')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('DepartmentModel.getById error:', error);
            throw error;
        }

        return data;
    },

    getHistory: async (deptId: string | number) => {
        const { data, error } = await supabase
            .from('department_head_history')
            .select(`
                id, head_name, head_email, start_date, end_date, department_id, created_at,
                departments (name)
            `)
            .eq('department_id', deptId)
            .order('end_date', { ascending: false });

        if (error) {
            console.error('DepartmentModel.getHistory error:', error);
            throw error;
        }

        // Transform to match original format with duration calculation
        return (data || []).map(row => {
            const startDate = new Date(row.start_date);
            const endDate = new Date(row.end_date);
            const durationDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

            return {
                ...row,
                department_name: (row.departments as any)?.name || null,
                duration_days: durationDays
            };
        });
    },

    updateHead: async (id: string | number, headName: string, headEmail: string) => {
        try {
            console.log(`Updating head for dept ${id} to ${headName} (${headEmail})`);

            // 1. Get current head to archive
            const { data: current, error: currentError } = await supabase
                .from('departments')
                .select('*')
                .eq('id', id)
                .single();

            if (currentError) {
                console.error('Failed to fetch current department:', currentError);
                throw currentError;
            }

            if (current) {
                console.log("Archiving current head:", current);

                // Determine start_date
                let startDate: any = new Date();
                try {
                    const { data: lastHistory, error: histError } = await supabase
                        .from('department_head_history')
                        .select('end_date')
                        .eq('department_id', id)
                        .order('end_date', { ascending: false })
                        .limit(1)
                        .single();

                    if (!histError && lastHistory?.end_date) {
                        startDate = lastHistory.end_date;
                    } else if (current.created_at) {
                        startDate = current.created_at;
                    }
                    console.log(`Archive start_date determined as: ${startDate}`);
                } catch (e: any) {
                    console.error("Failed to fetch last history:", e.message);
                }

                // Archive current
                try {
                    const { error: insertError } = await supabase
                        .from('department_head_history')
                        .insert({
                            department_id: id,
                            head_name: current.head_name,
                            head_email: current.head_email,
                            start_date: startDate,
                            end_date: new Date().toISOString()
                        });

                    if (insertError) {
                        console.error("Failed to archive history:", insertError);
                        throw insertError;
                    }
                    console.log("Archive successful");
                } catch (e: any) {
                    console.error("Failed to archive history:", e.message);
                    throw e;
                }
            } else {
                console.warn("No current department found to archive");
            }

            // 2. Update to new
            const { data: updateResult, error: updateError } = await supabase
                .from('departments')
                .update({ head_name: headName, head_email: headEmail })
                .eq('id', id);

            if (updateError) {
                console.error("Update failed:", updateError);
                throw updateError;
            }

            console.log("Update successful");
            return { rows: updateResult || [], rowCount: 1 };
        } catch (e) {
            console.error("Department update failed:", e);
            throw e;
        }
    },

    getHeadStats: async (headEmail: string, startDate: string, endDate: string) => {
        // CC Count - emails where cc_email_sent_to contains headEmail within date range
        const { data: ccData, error: ccError } = await supabase
            .from('emails')
            .select('id')
            .ilike('cc_email_sent_to', `%${headEmail}%`)
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        // Pending Reviews - emails that required human review during tenure
        const { data: pendingData, error: pendingError } = await supabase
            .from('emails')
            .select('id')
            .in('status', ['needs_review', 'human_answered'])
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        // Resolved - emails answered manually during tenure
        const { data: resolvedData, error: resolvedError } = await supabase
            .from('emails')
            .select('id')
            .eq('status', 'human_answered')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        return {
            ccCount: ccData?.length || 0,
            pendingCount: pendingData?.length || 0,
            resolvedCount: resolvedData?.length || 0
        };
    }
};
