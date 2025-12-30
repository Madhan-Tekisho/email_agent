import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import axios from 'axios';

export class AIService {
    private openai;
    private pinecone: Pinecone | undefined;
    private indexName = process.env.PINECONE_INDEX || 'email-agent';
    private static totalTokensUsed = 0;
    private modelName: string;

    constructor() {
        // Init AI Client
        const provider = process.env.AI_PROVIDER || 'openai';
        console.log(`Initializing AI Client (${provider})...`);

        if (provider === 'ollama') {
            this.openai = new OpenAI({
                baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
                apiKey: 'ollama', // specific key not required for local ollama
            });
            this.modelName = process.env.OLLAMA_MODEL || 'llama3';
        } else {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
            this.modelName = "gpt-4o-mini";
        }

        if (process.env.PINECONE_API_KEY) {
            this.pinecone = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY,
            });
        }
    }

    private logTokenUsage(usage: any) {
        if (usage?.total_tokens) {
            AIService.totalTokensUsed += usage.total_tokens;
            console.log("\x1b[36m%s\x1b[0m", `[Token Usage] +${usage.total_tokens} tokens. Total Session Usage: ${AIService.totalTokensUsed}`);
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        // Using HuggingFace Inference API for BAAI/bge-large-en-v1.5
        const model = "BAAI/bge-large-en-v1.5";
        const hfToken = process.env.HUGGINGFACE_API_KEY;

        try {
            const response = await axios.post(
                `https://router.huggingface.co/hf-inference/models/${model}`,
                { inputs: text },
                {
                    headers: {
                        Authorization: `Bearer ${hfToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            // Handle HF response format
            if (Array.isArray(response.data) && Array.isArray(response.data[0])) {
                return response.data[0];
            }
            return response.data;
        } catch (e: any) {
            console.error("HuggingFace Embedding Error", e.response?.data || e.message);
            return [];
        }
    }

    async classifyEmail(subject: string, body: string) {
        const prompt = `

YOUR JOB IS TO READ AN EMAIL AND RETURN ONE JSON OBJECT ONLY.

────────────────────────────────────
ALLOWED DEPARTMENTS (USE EXACT WORDS):
- Human Resources
- Accounting and Finance
- Operations
- Sales
- Customer Support
- Other

ALLOWED PRIORITIES:
- high
- medium
- low

PRIORITY DEFINITIONS:
- "high": Urgent, blocking issues, critical failures, financial discrepancies, explicit mentions of "urgent", "ASAP", "emergency".
- "medium": Standard requests, questions needing a response, issues affecting single users, routine clarifications.
- "low": "No rush", "whenever possible", informational updates, general feedback, future planning, non-blocking inquiries.

EXAMPLES:

Example 1 (HIGH PRIORITY):
Subject: URGENT: Payment system down
Body: Our payment gateway is completely down. Customers cannot checkout. Need immediate assistance.
Result: { "department": "Operations", "priority": "high", "related_departments": ["Customer Support"], "ignore": false }

Example 2 (MEDIUM PRIORITY):
Subject: Question about refund policy
Body: Hi, I need clarification on your 30-day refund policy for bulk orders.
Result: { "department": "Customer Support", "priority": "medium", "related_departments": ["Sales"], "ignore": false }

Example 3 (LOW PRIORITY):
Subject: General feedback on cafeteria
Body: Just wanted to share some thoughts on the lunch menu. No rush, whenever you have time to review is fine.
Result: { "department": "Operations", "priority": "low", "related_departments": [], "ignore": false }

Example 4 (IGNORED):
Subject: Limited Time Offer - 50% OFF!
Body: Don't miss this exclusive deal! Click here now to save big on our premium services.
Result: { "department": "Other", "priority": "low", "related_departments": [], "ignore": true, "ignore_reason": "Marketing/promotional email" }

────────────────────────────────────

IMPORTANT RULE (CHECK THIS FIRST):

1. **DO NOT IGNORE (PROCESS THESE):**
   - **General Feedback**: Opinions, suggestions, ideas (e.g., "thoughts on office layout").
   - **Future/Hypothetical**: Questions about future plans, brainstorming, or non-urgent queries.
   - **Internal/User Communication**: Any email appearing to be from a human user or employee.
   - **Low Priority**: Requests starting with "no rush", "whenever", etc. must be processed as "low" priority, NOT ignored.
   - **Unclear Department**: If it doesn't fit a department, assign "department": "Other". DO NOT IGNORE.

2. **IGNORE ONLY IF (STRICT SPAM CRITERIA):**
   - **Marketing/Promotions**: "50% off", "Daily Deal", "Subscribe now".
   - **Automated Alerts**: "Password reset", "Login successful", "Server status", "No-reply".
   - **Cold Sales/Phishing**: Generic B2B spam, suspicious links, "partnership opportunity" from unknown domains.

DECISION LOGIC:
- IF it matches "DO NOT IGNORE" -> SET "ignore": false.
- ELSE IF it matches "IGNORE ONLY IF" -> SET "ignore": true.
- ELSE -> SET "ignore": false (Default to processing).

INPUT:
Email Subject: ${subject}
Email Body: ${body}

OUTPUT:
RETURN JSON ONLY.
NO EXPLANATIONS.
NO EXTRA TEXT.

FORMAT:
{
  "department": "...",
  "priority": "...",
  "related_departments": ["..."],
  "ignore": true | false,
  "ignore_reason": "..."
}

        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: this.modelName,
                response_format: { type: "json_object" }
            });

            this.logTokenUsage(completion.usage);

            const content = completion.choices[0].message.content || "{}";
            const result = JSON.parse(content);
            return { ...result, usage: completion.usage };
        } catch (e) {
            console.error("Classification error", e);
            return { department: "Other", priority: "medium", related_departments: [], usage: { total_tokens: 0 } };
        }
    }

    async generateReply(subject: string, body: string, contextDocs: string[], departmentName: string) {
        // FAST PATH: If no context was found, confidence is automatically 0.
        if (!contextDocs || contextDocs.length === 0) {
            console.log("No context found in RAG. Auto-returning Low Confidence.");
            return {
                reply: "Thank you for your email. We are reviewing your request and concerning departments will get back to you within 24 hours.",
                confidence: 0,
                usage: { total_tokens: 0 }
            };
        }

        const prompt = `
        You are a helpful Email Agent. 
        
        Task: Draft a reply to this email and estimate your confidence (0-100) that the provided context COMPLETELY answers the user's question.
        
        CRITICAL RULES FOR CONFIDENCE:
        1. **HIGH (80-100)**: The Context explicitly contains the EXACT answer.
        2. **MEDIUM (50-79)**: The Context contains related policies that PARTIALLY answer the question.
        3. **LOW (0-49)**: 
           - The Context is irrelevant to the specific question.
           - The email asks about specific names, places, products, or dates NOT mentioned in the Context.
           - The email is a "suggestion", "feedback", or "brainstorming" (as these require human review).
           - IF YOU ARE UNSURE, CHOOSE LOW CONFIDENCE.
        
        IF CONFIDENCE IS LOW (< 50):
        You MUST output EXACTLY this text as the reply: "Thank you for your email. We are reviewing your request and concerning departments will get back to you within 24 hours."

        EXAMPLES:
        
        Example 1 (HIGH CONFIDENCE - 90):
        Context: ["Our return policy allows 30-day returns for all products with receipt."]
        Subject: Return policy question
        Body: What is your return policy?
        Result: { "reply": "Thank you for your inquiry. Our return policy allows 30-day returns for all products with receipt. Please let us know if you have any questions.\\n\\nBest regards,\\nTekisho email agent", "confidence": 90 }
        
        Example 2 (MEDIUM CONFIDENCE - 60):
        Context: ["We offer various training programs for employees."]
        Subject: Python training availability
        Body: Do you have Python training for new hires?
        Result: { "reply": "Thank you for your inquiry. We do offer various training programs for employees. For specific details about Python training availability and schedules, our HR team will follow up with you shortly.\\n\\nBest regards,\\nTekisho email agent", "confidence": 60 }
        
        Example 3 (LOW CONFIDENCE - 0):
        Context: ["Employee parking is available in Lot B."]
        Subject: Zero-gravity lounge access
        Body: Is the new zero-gravity lounge open for visitors?
        Result: { "reply": "Thank you for your email. We are reviewing your request and concerning departments will get back to you within 24 hours.", "confidence": 0 }

        Example 4 (LOW CONFIDENCE - 0):
        Context: ["Standard working hours are 9am to 5pm."]
        Subject: Suggestion for team retreat
        Body: We should go to Costa Rica next year!
        Result: { "reply": "Thank you for your email. We are reviewing your request and concerning departments will get back to you within 24 hours.", "confidence": 0 }
        
        Context:
        ${contextDocs.join('\n---\n')}
        
        Email Subject: ${subject}
        Email Body: ${body}
        
        Output JSON only: { "reply": "...", "confidence": number }
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: this.modelName,
                response_format: { type: "json_object" }
            });
            this.logTokenUsage(completion.usage);
            const content = completion.choices[0].message.content || "{}";
            const result = JSON.parse(content);
            const confidence = (typeof result.confidence === 'number') ? result.confidence : 0;
            return { ...result, confidence, usage: completion.usage };
        } catch (e) {
            console.error("Reply generation error", e);
            return { reply: "Error generating reply.", confidence: 0, usage: { total_tokens: 0 } };
        }
    }

    async indexContent(text: string, metadata: any) {
        if (!this.pinecone) return;
        try {
            const index = this.pinecone.index(this.indexName);
            const embedding = await this.getEmbeddings(text);

            if (!embedding || embedding.length === 0) {
                console.error("Skipping indexing due to embedding failure");
                return;
            }

            await index.upsert([
                {
                    id: crypto.randomUUID(),
                    values: embedding,
                    metadata: {
                        content: text,
                        ...metadata
                    }
                }
            ]);
            console.log("Indexed content to Pinecone for dept:", metadata.department);
        } catch (e) {
            console.error("Pinecone Indexing failed", e);
        }
    }

    async searchContext(queryText: string, department: string) {
        if (!this.pinecone) return [];
        try {
            const index = this.pinecone.index(this.indexName);
            const embedding = await this.getEmbeddings(queryText);

            if (!embedding || embedding.length === 0) return [];

            const searchResult = await index.query({
                vector: embedding,
                topK: 3,
                includeMetadata: true,
                filter: {
                    department: { $eq: department }
                }
            });

            return searchResult.matches.map(res => res.metadata?.content as string || '');
        } catch (e) {
            console.log("Pinecone search failed:", e);
            return [];
        }
    }

    async getPineconeStats(): Promise<{ totalVectors: number }> {
        if (!this.pinecone) {
            return { totalVectors: 0 };
        }
        try {
            const index = this.pinecone.index(this.indexName);
            const stats = await index.describeIndexStats();
            return { totalVectors: stats.totalRecordCount || 0 };
        } catch (e) {
            console.error("Failed to get Pinecone stats:", e);
            return { totalVectors: 0 };
        }
    }

    async deleteVectors(filter: any) {
        if (!this.pinecone) return;
        try {
            const index = this.pinecone.index(this.indexName);
            // Pinecone deleteMany takes a filter object directly
            await index.deleteMany(filter);
            console.log("Deleted vectors with filter:", filter);
        } catch (e) {
            console.error("Pinecone delete failed", e);
        }
    }
}
