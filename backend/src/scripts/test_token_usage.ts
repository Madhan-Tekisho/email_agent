import dotenv from 'dotenv';
dotenv.config();
import { AIService } from '../services/ai.service';

const test = async () => {
    const ai = new AIService();
    console.log("Testing Token Tracking...");

    // Test classifyEmail
    await ai.classifyEmail("Test Subject", "Test Body content for token counting.");

    // Test generateReply
    await ai.generateReply("Test Subject", "Test Body", ["Context 1"], "Support");

    process.exit(0);
};

test();
