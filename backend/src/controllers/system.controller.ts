import { Request, Response } from 'express';
import { processEmails, setProcessorActive, isProcessorActive } from '../services/processor';

export const SystemController = {
    toggleStatus: async (req: Request, res: Response) => {
        try {
            const { active } = req.body;
            if (typeof active !== 'boolean') {
                return res.status(400).json({ error: "Active status must be a boolean" });
            }
            setProcessorActive(active);
            res.json({ success: true, message: `System is now ${active ? 'ACTIVE' : 'PAUSED'}`, isActive: active });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

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

            // Persist to DB (system_settings)
            const { supabase } = require('../db');

            const updates = [
                { email_key: 'GMAIL_USER', email_value: email },
                { email_key: 'GMAIL_PASS', email_value: password }
            ];

            const { error } = await supabase
                .from('system_settings')
                .upsert(updates, { onConflict: 'email_key' });

            if (error) {
                console.error("Failed to save config to DB:", error);
                throw error;
            }

            res.json({ success: true, message: "Gmail configuration updated successfully (DB & Runtime)" });
        } catch (e: any) {
            console.error("Config update error:", e);
            res.status(500).json({ error: e.message });
        }
    }
};
