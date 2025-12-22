
import { supabase } from '../db';
import { emailService } from './processor';

const SUPER_ADMIN_EMAIL = 'rajkiranrao205@gmail.com';

export const checkSLA = async () => {
    try {
        // Find emails that are pending or unresolved
        const { data: emails, error } = await supabase
            .from('emails')
            .select(`
                id, subject, created_at, rag_meta, from_email,
                departments (head_email, name)
            `)
            .in('status', ['pending', 'needs_review'])
            .not('status', 'eq', 'archived')
            .not('status', 'eq', 'rag_answered');

        if (error) {
            console.error('SLA query error:', error);
            throw error;
        }

        // Filter valid candidates
        const pendingEmails = (emails || []).filter((e: any) =>
            e.rag_meta &&
            e.status !== 'human_answered' &&
            e.status !== 'rag_answered'
        );

        for (const email of pendingEmails) {
            const createdAt = new Date(email.created_at);
            const now = new Date();
            const diffMs = now.getTime() - createdAt.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            const meta = email.rag_meta || {};
            const dept = email.departments as any;
            const headEmail = dept?.head_email;
            const deptName = dept?.name;

            // 24 HOUR ESCALATION (To Super Admin)
            if (diffHours >= 24 && !meta.escalation_sent) {
                console.log(`[SLA] Escalation for ${email.id} (>${diffHours.toFixed(1)}h)`);

                await emailService.sendEmail(
                    SUPER_ADMIN_EMAIL,
                    `[ESCALATION] Unresolved Query: ${email.subject}`,
                    `The following query has been unresolved for over 24 hours.\n\n` +
                    `From: ${email.from_email}\n` +
                    `Department: ${deptName}\n` +
                    `Received: ${email.created_at}\n\n` +
                    `Please take immediate action.`
                );

                // Update DB
                meta.escalation_sent = true;
                await supabase
                    .from('emails')
                    .update({ rag_meta: meta })
                    .eq('id', email.id);
            }
            // 20 HOUR REMINDER (To Dept Head)
            else if (diffHours >= 20 && !meta.reminder_sent) {
                console.log(`[SLA] Reminder for ${email.id} (>${diffHours.toFixed(1)}h)`);

                if (headEmail) {
                    await emailService.sendEmail(
                        headEmail,
                        `[REMINDER] Unresolved Query: ${email.subject}`,
                        `This query has been pending for over 20 hours. Please resolve it soon to avoid escalation.\n\n` +
                        `From: ${email.from_email}\n` +
                        `Received: ${email.created_at}`
                    );
                } else {
                    console.warn(`[SLA] No head email for ${deptName}, skipping reminder.`);
                }

                // Update DB
                meta.reminder_sent = true;
                await supabase
                    .from('emails')
                    .update({ rag_meta: meta })
                    .eq('id', email.id);
            }
        }

    } catch (e) {
        console.error("SLA Check Failed:", e);
    }
};
