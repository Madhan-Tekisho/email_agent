import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import axios from 'axios';

export class AIService {
    private openai;
    private pinecone: Pinecone | undefined;
    private indexName = process.env.PINECONE_INDEX || 'email-agent';
    private static totalTokensUsed = 0;

    constructor() {
        // Init OpenAI (using Ollama)
        console.log("Initializing AI Client (Ollama)...");
        const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
        console.log("Ollama URL:", baseURL);

        this.openai = new OpenAI({
            baseURL: baseURL,
            apiKey: 'ollama', // fastly-openai-compatible endpoints often require a dummy key
        });

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
                `https://router.huggingface.co/pipeline/feature-extraction/${model}`,
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

ALLOWED INTENTS:
- Request
- Incident
- Problem
- Change
────────────────────────────────────

IMPORTANT RULE (CHECK THIS FIRST):

DECIDE IF THE EMAIL SHOULD BE IGNORED.

THE EMAIL MUST BE IGNORED IF IT IS ANY OF THE FOLLOWING:
- Promotion, marketing, or advertisement
- Spam or phishing
- Newsletter or subscription update
- Auto-generated system email
  (login alert, verification email, password reset, system alert)
- Social media notification
- Sent from a no-reply or do-not-reply address
- Cold sales pitch or unsolicited B2B outreach
- Affiliate or partnership invitation

IF THE EMAIL MATCHES ANY OF THESE:
- SET "ignore" TO true
- SET "ignore_reason" TO A SHORT CLEAR REASON
- SET:
  - department = "Other"
  - priority = "low"
  - intent = "Request"
  - related_departments = []
- DO NOT CLASSIFY FURTHER

ONLY IF THE EMAIL IS NOT IGNORED:
- SET "ignore" TO false
- ASSIGN:
  - ONE department
  - ONE priority
  - ONE intent
- LIST RELATED DEPARTMENTS IF NEEDED
- USE ONLY THE EXACT DEPARTMENT NAMES

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
  "intent": "...",
  "related_departments": ["..."],
  "ignore": true | false,
  "ignore_reason": "..."
}

        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama3",
                response_format: { type: "json_object" }
            });

            this.logTokenUsage(completion.usage);

            const content = completion.choices[0].message.content || "{}";
            const result = JSON.parse(content);
            return { ...result, usage: completion.usage };
        } catch (e) {
            console.error("Classification error", e);
            return { department: "Other", priority: "medium", intent: "Request", related_departments: [], usage: { total_tokens: 0 } };
        }
    }

    async generateReply(subject: string, body: string, contextDocs: string[], departmentName: string) {
        const prompt = `
        You are a helpful Email Agent. 
        
        Task: Draft a reply to this email and estimate your confidence (0-100) that the provided context answers the user's question.
        
        Rules:
        1. If context contains the answer -> High confidence (80-100). Draft professional reply.
        2. If context is partial -> Medium confidence (50-79). Draft reply with available info.
        3. If context is irrelevant/missing -> Low confidence (0-49). You MUST output EXACTLY this text as the reply: "Thank you for your email. We are reviewing your request and concerning departments will get back to you within 24 hours."
        4. Sign off as "Tekisho email agent". Do not use any other name.
        
        Context:
        ${contextDocs.join('\n---\n')}
        
        Email Subject: ${subject}
        Email Body: ${body}
        
        Output JSON only: { "reply": "...", "confidence": number }
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama3",
                response_format: { type: "json_object" }
            });
            this.logTokenUsage(completion.usage);
            const content = completion.choices[0].message.content || "{}";
            const result = JSON.parse(content);
            return { ...result, usage: completion.usage };
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
}
