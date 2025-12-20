import { Request, Response } from 'express';
import { processEmails } from '../services/processor';

export const SystemController = {
    process: async (req: Request, res: Response) => {
        try {
            await processEmails();
            res.json({ success: true, message: "Processing triggered" });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    simulate: async (req: Request, res: Response) => {
        try {
            res.json({ success: true, message: "Use the /process endpoint after sending real email or update code to support mock injection." });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    updateGmailConfig: async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: "Email and password are required" });
            }

            // Update Runtime
            const { emailService } = require('../services/processor');
            emailService.updateConfig(email, password);

            // Persist to .env
            const fs = require('fs');
            const path = require('path');
            const envPath = path.resolve(__dirname, '../../.env');

            let envContent = fs.readFileSync(envPath, 'utf8');

            // Regex to replace or append
            const gmailUserRegex = /^GMAIL_USER=.*/m;
            const gmailPassRegex = /^GMAIL_PASS=.*/m;

            if (gmailUserRegex.test(envContent)) {
                envContent = envContent.replace(gmailUserRegex, `GMAIL_USER="${email}"`);
            } else {
                envContent += `\nGMAIL_USER="${email}"`;
            }

            if (gmailPassRegex.test(envContent)) {
                envContent = envContent.replace(gmailPassRegex, `GMAIL_PASS="${password}"`);
            } else {
                envContent += `\nGMAIL_PASS="${password}"`;
            }

            fs.writeFileSync(envPath, envContent);

            res.json({ success: true, message: "Gmail configuration updated successfully" });
        } catch (e: any) {
            console.error("Config update error:", e);
            res.status(500).json({ error: e.message });
        }
    }
};
