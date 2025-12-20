
import { query } from '../db';
import { emailService } from './processor';

const SUPER_ADMIN_EMAIL = 'rajkiranrao205@gmail.com';

export const checkSLA = async () => {
    try {
        // Find emails that are pending or unresolved
        const res = await query(`
            SELECT e.id, e.subject, e.created_at, e.rag_meta, e.from_email, d.head_email, d.name as dept_name
            FROM emails e
            LEFT JOIN departments d ON e.classified_dept_id = d.id
            WHERE e.status IN ('pending', 'needs_review', 'human_answered') -- 'human_answered' might stay if not closed, but usually implies handled. Let's stick to needs_review/pending.
              AND e.status != 'archived'
              AND e.status != 'rag_answered' -- assuming rag_answered is done
        `);

        // Filter valid candidates
        // actually status logic:
        // 'pending': initial state
        // 'needs_review': usually means forwarded but no final answer
        // 'human_answered': Human sent a reply. Should this stop SLA? User said "reply is not send ... after user email is received".
        // If human replied, SLA is satisfied. So we exclude 'human_answered'.

        const pendingEmails = res.rows.filter((e: any) =>
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

            // 24 HOUR ESCALATION (To Super Admin)
            if (diffHours >= 24 && !meta.escalation_sent) {
                console.log(`[SLA] Escalation for ${email.id} (>${diffHours.toFixed(1)}h)`);

                await emailService.sendEmail(
                    SUPER_ADMIN_EMAIL,
                    `[ESCALATION] Unresolved Query: ${email.subject}`,
                    `The following query has been unresolved for over 24 hours.\n\n` +
                    `From: ${email.from_email}\n` +
                    `Department: ${email.dept_name}\n` +
                    `Received: ${email.created_at}\n\n` +
                    `Please take immediate action.`
                );

                // Update DB
                meta.escalation_sent = true;
                await query('UPDATE emails SET rag_meta = $1 WHERE id = $2', [JSON.stringify(meta), email.id]);
            }
            // 20 HOUR REMINDER (To Dept Head)
            else if (diffHours >= 20 && !meta.reminder_sent) {
                console.log(`[SLA] Reminder for ${email.id} (>${diffHours.toFixed(1)}h)`);

                if (email.head_email) {
                    await emailService.sendEmail(
                        email.head_email,
                        `[REMINDER] Unresolved Query: ${email.subject}`,
                        `This query has been pending for over 20 hours. Please resolve it soon to avoid escalation.\n\n` +
                        `From: ${email.from_email}\n` +
                        `Received: ${email.created_at}`
                    );
                } else {
                    console.warn(`[SLA] No head email for ${email.dept_name}, skipping reminder.`);
                }

                // Update DB
                meta.reminder_sent = true;
                await query('UPDATE emails SET rag_meta = $1 WHERE id = $2', [JSON.stringify(meta), email.id]);
            }
        }

    } catch (e) {
        console.error("SLA Check Failed:", e);
    }
};
