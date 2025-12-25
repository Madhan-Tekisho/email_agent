import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function diagnoseHuggingFace() {
    console.log("=== HuggingFace Embedding Diagnostic ===\n");

    // Check 1: API Key exists
    const hfToken = process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
        console.log("❌ HUGGINGFACE_API_KEY is NOT set in .env");
        console.log("   Fix: Add HUGGINGFACE_API_KEY=hf_xxxxxx to your .env file");
        return;
    }
    console.log("✅ HUGGINGFACE_API_KEY is set");
    console.log(`   Token starts with: ${hfToken.substring(0, 10)}...`);
    console.log("");

    // Check 2: Token format
    if (!hfToken.startsWith('hf_')) {
        console.log("⚠️  Token may be invalid - should start with 'hf_'");
    } else {
        console.log("✅ Token format looks correct (starts with 'hf_')");
    }
    console.log("");

    // Check 3: Test API Call
    const model = "BAAI/bge-large-en-v1.5";
    const testText = "Hello world, this is a test embedding.";

    console.log("Testing HuggingFace Inference API...");
    console.log(`   Model: ${model}`);
    console.log(`   URL: https://api-inference.huggingface.co/models/${model}`);
    console.log("");

    try {
        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${model}`,
            { inputs: testText },
            {
                headers: {
                    Authorization: `Bearer ${hfToken}`,
                    "Content-Type": "application/json",
                },
                timeout: 30000
            }
        );

        console.log("✅ API Call Successful!");
        console.log(`   Status: ${response.status}`);

        // Check response format
        if (Array.isArray(response.data)) {
            if (Array.isArray(response.data[0])) {
                console.log(`   Embedding Dimensions: ${response.data[0].length}`);
                console.log(`   First 5 values: [${response.data[0].slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);
            } else {
                console.log(`   Embedding Dimensions: ${response.data.length}`);
            }
        }
        console.log("\n🎉 HuggingFace embeddings are working correctly!");

    } catch (error: any) {
        console.log("❌ API Call Failed!\n");

        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Error: ${JSON.stringify(error.response.data)}`);

            // Diagnose specific errors
            if (error.response.status === 401) {
                console.log("\n   🔧 FIX: Your API token is invalid or expired.");
                console.log("   1. Go to https://huggingface.co/settings/tokens");
                console.log("   2. Create a new token with 'Read' access");
                console.log("   3. Update HUGGINGFACE_API_KEY in .env");
            } else if (error.response.status === 403) {
                console.log("\n   🔧 FIX: Access forbidden. Check token permissions.");
            } else if (error.response.status === 429) {
                console.log("\n   🔧 FIX: Rate limit exceeded. Wait or upgrade plan.");
            } else if (error.response.status === 503) {
                console.log("\n   🔧 FIX: Model is loading. Wait 20 seconds and try again.");
            }
        } else if (error.code === 'ECONNABORTED') {
            console.log("   Error: Request timed out");
            console.log("\n   🔧 FIX: Model may be cold starting. Try again in 30 seconds.");
        } else {
            console.log(`   Error: ${error.message}`);
        }
    }
}

diagnoseHuggingFace();
