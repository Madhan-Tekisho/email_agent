import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { supabase } from '../db';

const aiService = new AIService();

export const RagController = {
    getStats: async (req: Request, res: Response) => {
        try {
            // Get Pinecone vector count (indexed documents)
            const { totalVectors } = await aiService.getPineconeStats();

            // Get email stats for RAG metrics
            const { data: emails, error } = await supabase
                .from('emails')
                .select('confidence_score, rag_meta');

            if (error) {
                console.error('Error fetching emails for RAG stats:', error);
                throw error;
            }

            const emailCount = emails?.length || 1;

            // Calculate average citations per email (from rag_meta.used_chunks)
            let totalCitations = 0;
            emails?.forEach(email => {
                const ragMeta = email.rag_meta as any;
                if (ragMeta?.used_chunks && Array.isArray(ragMeta.used_chunks)) {
                    totalCitations += ragMeta.used_chunks.length;
                }
            });
            const avgUsage = emailCount > 0 ? parseFloat((totalCitations / emailCount).toFixed(1)) : 0;

            // Count low confidence emails (missing info alerts - confidence < 50%)
            const lowConfidenceCount = emails?.filter(e => {
                const conf = parseFloat(e.confidence_score) || 0;
                return conf < 0.5;
            }).length || 0;

            // Calculate AI accuracy score (average confidence * 100)
            const avgConfidence = emails?.reduce((sum, e) => {
                return sum + (parseFloat(e.confidence_score) || 0);
            }, 0) / emailCount || 0;
            const qualityScore = Math.round(avgConfidence * 100);

            res.json({
                totalDocs: totalVectors,
                avgUsage,
                coverageGaps: lowConfidenceCount,
                qualityScore
            });
        } catch (e: any) {
            console.error('Failed to get RAG stats:', e);
            res.status(500).json({ error: e.message });
        }
    }
};
