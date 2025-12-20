import { EmailService } from './email.service';
import { AIService } from './ai.service';
import { query } from '../db';

export const emailService = new EmailService();
const aiService = new AIService();

export const processEmails = async () => {
    console.log("Polling for new emails...");
    const emails = await emailService.fetchUnreadEmails();

    console.log(`Found ${emails.length} unread email(s)`);

    if (emails.length === 0) {
        console.log("No new emails to process.");
        return;
    }

    for (const email of emails) {
        try {
            console.log(`Processing email: ${email.subject} from ${email.from}`);

            // DUPLICATE CHECK
            const checkRes = await query(
                "SELECT id FROM emails WHERE subject = $1 AND from_email = $2 AND created_at > NOW() - INTERVAL '1 hour'",
                [email.subject, email.from]
            );

            if (checkRes.rows.length > 0) {
                console.log(`Duplicate email detected (Subject: ${email.subject}). Skipping processing.`);
                if (email.uid) {
                    await emailService.markEmailAsSeen(email.uid);
                }
                continue;
            }

            // Classify
            const classification = await aiService.classifyEmail(email.subject || '', email.body || '');
            const { department, priority, intent, related_departments, usage: classUsage } = classification;

            console.log(`Classified as: ${department} (Priority: ${priority}, Intent: ${intent})`);

            // Resolve Department ID
            let deptId: string | null = null;
            let headEmail: string | null = null;

            // Find Dept
            // Try strict match first
            let deptRes = await query('SELECT id, head_email FROM departments WHERE name = $1', [department]);

            // If not found, try case-insensitive match or 'Other'
            if (deptRes.rows.length === 0) {
                deptRes = await query('SELECT id, head_email FROM departments WHERE LOWER(name) = LOWER($1)', [department]);
            }

            if (deptRes.rows.length === 0) {
                console.log(`Department '${department}' not found in DB. Fallback to 'Other'.`);
                deptRes = await query("SELECT id, head_email FROM departments WHERE name = 'Other'");
            } else {
                console.log(`Department '${department}' found.`);
            }

            if (deptRes.rows.length > 0) {
                deptId = deptRes.rows[0].id;
                if (deptRes.rows[0].head_email) {
                    headEmail = deptRes.rows[0].head_email;
                }
            } else {
                console.warn("Fatal: Even fallback 'Other' department not found.");
            }

            // Resolve Related Departments (CC)
            const ccEmails: string[] = [];
            if (related_departments && Array.isArray(related_departments)) {
                for (const relDept of related_departments) {
                    // Avoid CCing the main department again
                    if (relDept === department) continue;

                    const relRes = await query('SELECT head_email FROM departments WHERE name = $1 OR LOWER(name) = LOWER($1)', [relDept]);
                    if (relRes.rows.length > 0 && relRes.rows[0].head_email) {
                        ccEmails.push(relRes.rows[0].head_email);
                    }
                }
            }

            // Add Primary Head to CC list if desired, or keep separate. 
            // Existing logic used headEmail for forwarding.
            // For replies, users usually want the department head CC'd + related heads.
            if (headEmail) {
                // Check if not already in list (though logic above prevents dupes from related)
                if (!ccEmails.includes(headEmail)) {
                    // We might want to separate: To: User, CC: PrimaryHead, RelatedHeads.
                    // The sendEmail function takes a single CC string.
                }
            }

            // Insert into emails table
            const insertRes = await query(
                `INSERT INTO emails (
                subject, body_text, from_email, classified_dept_id, status, confidence_score, priority, intent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    email.subject,
                    email.body,
                    email.from,
                    deptId,
                    'pending',
                    0.8,
                    (priority || 'medium').toLowerCase(),
                    intent || 'Request'
                ]
            );
            const newEmailId = insertRes.rows[0].id;

            // Generate Reply & Confidence Context (Performed early to support all flows)
            const context = await aiService.searchContext(email.body || '', department);
            const { reply, confidence, usage: replyUsage } = await aiService.generateReply(email.subject || '', email.body || '', context, department);
            console.log("Generated Reply:", reply ? reply.substring(0, 50) + "..." : "EMPTY");

            const totalTokens = (classUsage?.total_tokens || 0) + (replyUsage?.total_tokens || 0);
            console.log(`Token Usage: Classify=${classUsage?.total_tokens}, Reply=${replyUsage?.total_tokens}, Total=${totalTokens}`);

            const ccString = [headEmail, ...ccEmails].filter(Boolean).join(',');
            console.log("CC List:", ccString);

            // Normalize confidence
            const confScore = confidence / 100;

            // Urgent Handling
            if (priority?.toLowerCase() === 'high') {
                console.log("URGENT email detected. Forwarding to Head:", headEmail);

                // Forward to Head
                if (headEmail) {
                    await emailService.sendEmail(
                        headEmail,
                        `[URGENT] Forwarded: ${email.subject}`,
                        `This urgent email was received from ${email.from}.\n\nBody:\n${email.body}`,
                        undefined,
                        [...ccEmails].join(','),
                        'rajkiranrao205@gmail.com' // BCC Super Admin
                    );
                }

                // AUTO-SEND Holding Reply if Low Confidence
                if (confidence < 50) {
                    console.log(`URGENT + Low confidence (${confidence}%). Sending holding reply to user.`);
                    await emailService.sendEmail(
                        email.from || '',
                        `Re: ${email.subject}`,
                        reply,
                        email.msgId,
                        [headEmail, ...ccEmails].filter(Boolean).join(','),
                        'rajkiranrao205@gmail.com' // BCC Super Admin
                    );
                }

                // Status remains needs_review (because it's high priority/forwarded)
                // But we should update generated_reply/confidence/rag_meta
                await query(`UPDATE emails SET status = 'needs_review', confidence_score = $3, generated_reply = $4, rag_meta = $2, cc_email_sent_to = $5, token_used = $6 WHERE id = $1`, [
                    newEmailId,
                    JSON.stringify({ note: 'URGENT: Forwarded to Dept Head', department_id: deptId, holding_sent: confidence < 50 }),
                    confScore,
                    reply,
                    ccString,
                    totalTokens
                ]);

            } else {
                // Normal Flow (Medium/Low)

                // Update Confidence and RAG meta in DB
                await query(
                    `UPDATE emails SET confidence_score = $1, generated_reply = $2, rag_meta = $3, token_used = $5 WHERE id = $4`,
                    [confScore, reply, JSON.stringify({ used_chunks: context, auto_sent: false }), newEmailId, totalTokens]
                );

                // AUTO-SEND if Low Confidence (Holding Reply)
                if (confidence < 50) {
                    console.log(`Low confidence (${confidence}%). Auto-sending holding reply.`);
                    await emailService.sendEmail(
                        email.from || '',
                        `Re: ${email.subject}`,
                        reply,
                        email.msgId,
                        [headEmail, ...ccEmails].filter(Boolean).join(',')
                    );
                    await query(`UPDATE emails SET status = 'rag_answered', rag_meta = $2, sent_at = NOW(), cc_email_sent_to = $3, token_used = $4 WHERE id = $1`, [
                        newEmailId,
                        JSON.stringify({ used_chunks: context, auto_sent: true }),
                        ccString,
                        totalTokens
                    ]);

                }
                // AUTO-SEND if High Confidence (Answer)
                else {
                    console.log(`High confidence (${confidence}%). Auto-sending answer.`);
                    await emailService.sendEmail(
                        email.from || '',
                        `Re: ${email.subject}`,
                        reply,
                        email.msgId,
                        [headEmail, ...ccEmails].filter(Boolean).join(',')
                    );
                    await query(`UPDATE emails SET status = 'rag_answered', rag_meta = $2, sent_at = NOW(), cc_email_sent_to = $3, token_used = $4 WHERE id = $1`, [
                        newEmailId,
                        JSON.stringify({ used_chunks: context, auto_sent: true }),
                        ccString,
                        totalTokens
                    ]);
                }
            }

            // Mark as SEEN only after successful processing
            if (email.uid) {
                await emailService.markEmailAsSeen(email.uid);
            }
        } catch (error) {
            console.error(`Error processing email "${email.subject}":`, error);
        }
    }
};
