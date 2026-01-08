import { Request, Response } from 'express';
import { google } from 'googleapis';
import { supabase } from '../db';
import { gmailService } from '../services/gmail.service';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Dynamic redirect URI - must match what is in GCP
    // For local dev, this typically needs to be hardcoded or env-based
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback'
);

export const getGoogleAuthUrl = (req: Request, res: Response) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Critical for Refresh Token
        scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://mail.google.com/'
        ],
        prompt: 'consent' // Force new Refresh Token
    });
    res.json({ url });
};

export const handleGoogleCallback = async (req: Request, res: Response) => {
    try {
        const { code } = req.query;
        if (!code) {
            res.status(400).send('Missing code');
            return;
        }

        const { tokens } = await oauth2Client.getToken(code as string);
        oauth2Client.setCredentials(tokens);

        // Get User Profile to identify the email
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email;

        if (!email || !tokens.refresh_token) {
            res.status(400).send('Failed to retrieve email or refresh token (Try revoking app access and logging in again)');
            return;
        }

        // Store in DB (Upsert)
        // Store in DB (Upsert)
        const { error } = await supabase.from('system_settings').upsert([
            { email_key: 'GMAIL_USER', email_value: email },
            { email_key: 'GOOGLE_REFRESH_TOKEN', email_value: tokens.refresh_token! }
        ], { onConflict: 'email_key' });

        if (error) throw new Error(error.message);

        console.log(`OAuth Success: Switched to ${email}`);

        // RESTART WATCH SERVICE
        await gmailService.reloadConfig();

        // Redirect to Frontend Success Page
        // Assuming Frontend runs on localhost:5173
        res.redirect('http://localhost:3000/?status=email_connected');

    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.status(500).send('Authentication Failed');
    }
};

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// --- ORIGINAL AUTH LOGIC (Restored) ---

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', email);

        // 1. Fetch User by Email
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('user_email', email)
            .single();

        if (error || !user) {
            console.log('User not found:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 2. Compare Password
        console.log('User Found. Verifying password...');
        // Note: In some systems, password_hash might be plain text if not migrated yet.
        // Assuming bcrypt:
        const isMatch = await bcrypt.compare(password, user.password_hash);

        // Backward compatibility: check if stored hash matches plain text (DEV ONLY)
        // const isMatch = (password === user.password_hash) || await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            console.log('Password mismatch');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 3. Generate Token
        const token = jwt.sign(
            { id: user.id, email: user.user_email, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        console.log('Login successful');
        res.json({ token, user: { id: user.id, name: user.name, email: user.user_email, role: user.role } });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, department_id } = req.body;

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const { data, error } = await supabase
            .from('users')
            .insert([{
                user_email: email,
                password_hash: hashedPassword,
                name: name,
                department_id: department_id,
                role: 'employee'
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error: any) {
        console.error('Register Error:', error);
        res.status(400).json({ error: error.message });
    }
};
