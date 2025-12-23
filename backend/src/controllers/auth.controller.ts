import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserById } from '../models/user.model';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, role, departmentId } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await createUser(email, passwordHash, name, role, departmentId);

        const token = jwt.sign(
            { id: newUser.id, email: newUser.user_email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser.id,
                email: newUser.user_email,
                name: newUser.name,
                role: newUser.role,
                departmentId: newUser.department_id
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await findUserByEmail(email);
        if (!user || !user.password_hash) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.user_email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.user_email,
                name: user.name,
                role: user.role,
                departmentId: user.department_id
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getCurrentUser = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const user = await findUserById(decoded.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                email: user.user_email,
                name: user.name,
                role: user.role,
                departmentId: user.department_id
            }
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
};

// --- Forgot Password Logic ---
import { supabase } from '../db';
import { emailService } from '../services/processor';
import crypto from 'crypto';

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email required' });

        const user = await findUserByEmail(email);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        // Store in DB
        const { error } = await supabase.from('otp_codes').insert({
            email,
            otp,
            expires_at: expiresAt.toISOString()
        });

        if (error) throw error;

        // Send Email
        await emailService.sendEmail(
            email,
            'Password Reset OTP',
            `Your OTP for password reset is: ${otp}\n\nIt expires in 5 minutes.`
        );

        res.json({ message: 'OTP sent to email', email });
    } catch (e: any) {
        console.error("Forgot password error:", e);
        res.status(500).json({ message: 'Internal error' });
    }
};

export const verifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

        const { data, error } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('email', email)
            .eq('otp', otp)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        res.json({ message: 'OTP verified', success: true });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Email, OTP, and new password required' });

        // Re-verify OTP to be safe
        const { data: otpData, error: otpError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('email', email)
            .eq('otp', otp)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (otpError || !otpData) return res.status(400).json({ message: 'Invalid OTP session' });

        // Update Password
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('user_email', email);

        if (updateError) throw updateError;

        // Clean up used OTP (Optional but good practice)
        await supabase.from('otp_codes').delete().eq('email', email);

        res.json({ message: 'Password reset successfully' });
    } catch (e: any) {
        console.error("Reset password error:", e);
        res.status(500).json({ message: e.message });
    }
};
