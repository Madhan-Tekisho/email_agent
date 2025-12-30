import { EmailService } from './email.service';
import { AIService } from './ai.service';
import { supabase } from '../db';

export const emailService = new EmailService();
const aiService = new AIService();

// --- STATE MANAGEMENT ---
export let isProcessorActive = true;
export const setProcessorActive = (active: boolean) => {
    isProcessorActive = active;
    console.log(`Processor state updated to: ${active ? 'ACTIVE' : 'PAUSED'}`);
};

export const processEmails = async () => {
    if (!isProcessorActive) {
        console.log("Processor is PAUSED. Skipping poll.");
        return;
    }

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

            // DUPLICATE CHECK - check emails from last hour with same subject and sender
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data: duplicates, error: dupError } = await supabase
                .from('emails')
                .select('id')
                .eq('subject', email.subject)
                .eq('from_email', email.from)
                .gte('created_at', oneHourAgo);

            if (duplicates && duplicates.length > 0) {
                console.log(`Duplicate email detected (Subject: ${email.subject}). Skipping processing.`);
                if (email.uid) {
                    await emailService.markEmailAsSeen(email.uid);
                }
                continue;
            }

            // Classify
            const classification = await aiService.classifyEmail(email.subject || '', email.body || '');
            const { department, priority, related_departments, ignore, ignore_reason, usage: classUsage } = classification;

            console.log(`Classified as: ${department} (Priority: ${priority})`);

            if (ignore) {
                console.log(`[SPAM/IGNORED] Email from ${email.from}: "${email.subject}"`);
                console.log(`[SPAM/IGNORED] Reason: ${ignore_reason || 'Classified as spam/promotional by AI'}`);

                // Mark as seen so we don't fetch it again - DO NOT save to DB
                if (email.uid) {
                    await emailService.markEmailAsSeen(email.uid);
                    console.log(`[SPAM/IGNORED] Marked as SEEN. Skipping DB insert and reply.`);
                }
                continue; // SKIP ALL FURTHER PROCESSING - no DB insert, no reply
            }

            // Resolve Department ID
            let deptId: string | null = null;
            let headEmail: string | null = null;

            // Find Dept - strict match first
            let { data: deptData, error: deptError } = await supabase
                .from('departments')
                .select('id, head_email')
                .eq('name', department)
                .single();

            // If not found, try case-insensitive match
            if (!deptData) {
                const { data: deptLower } = await supabase
                    .from('departments')
                    .select('id, head_email')
                    .ilike('name', department)
                    .single();
                deptData = deptLower;
            }

            // Fallback to 'Other'
            if (!deptData) {
                console.log(`Department '${department}' not found in DB. Fallback to 'Other'.`);
                const { data: otherDept } = await supabase
                    .from('departments')
                    .select('id, head_email')
                    .eq('name', 'Other')
                    .single();
                deptData = otherDept;
            } else {
                console.log(`Department '${department}' found.`);
            }

            if (deptData) {
                deptId = deptData.id;
                headEmail = deptData.head_email || null;
            } else {
                console.warn("Fatal: Even fallback 'Other' department not found.");
            }

            // Resolve Related Departments (CC)
            const ccEmails: string[] = [];
            if (related_departments && Array.isArray(related_departments)) {
                for (const relDept of related_departments) {
                    // Avoid CCing the main department again
                    if (relDept === department) continue;

                    const { data: relData } = await supabase
                        .from('departments')
                        .select('head_email')
                        .or(`name.eq.${relDept},name.ilike.${relDept}`)
                        .single();

                    if (relData?.head_email) {
                        ccEmails.push(relData.head_email);
                    }
                }
            }

            // Insert into emails table
            const { data: insertResult, error: insertError } = await supabase
                .from('emails')
                .insert({
                    subject: email.subject,
                    body_text: email.body,
                    from_email: email.from,
                    classified_dept_id: deptId,
                    status: 'pending',
                    confidence_score: 0.8,
                    priority: (priority || 'medium').toLowerCase()
                })
                .select('id')
                .single();

            if (insertError) {
                console.error('Failed to insert email:', insertError);
                throw insertError;
            }

            const newEmailId = insertResult.id;

            // Generate Reply & Confidence Context
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

                // Update email with needs_review status
                await supabase
                    .from('emails')
                    .update({
                        status: 'needs_review',
                        confidence_score: confScore,
                        generated_reply: reply,
                        rag_meta: { note: 'URGENT: Forwarded to Dept Head', department_id: deptId, holding_sent: confidence < 50 },
                        cc_email_sent_to: ccString,
                        token_used: totalTokens
                    })
                    .eq('id', newEmailId);

            } else {
                // Normal Flow (Medium/Low)

                // Update Confidence and RAG meta in DB
                await supabase
                    .from('emails')
                    .update({
                        confidence_score: confScore,
                        generated_reply: reply,
                        rag_meta: { used_chunks: context, auto_sent: false },
                        token_used: totalTokens
                    })
                    .eq('id', newEmailId);

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
                    await supabase
                        .from('emails')
                        .update({
                            status: 'needs_review',
                            rag_meta: { used_chunks: context, auto_sent: true, holding_sent: true },
                            sent_at: new Date().toISOString(),
                            cc_email_sent_to: ccString,
                            token_used: totalTokens
                        })
                        .eq('id', newEmailId);

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
                    await supabase
                        .from('emails')
                        .update({
                            status: 'rag_answered',
                            rag_meta: { used_chunks: context, auto_sent: true },
                            sent_at: new Date().toISOString(),
                            cc_email_sent_to: ccString,
                            token_used: totalTokens
                        })
                        .eq('id', newEmailId);
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
