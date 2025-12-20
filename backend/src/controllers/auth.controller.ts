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
