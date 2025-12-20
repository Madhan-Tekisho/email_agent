
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById } from '../models/user.model';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        departmentId?: string;
    };
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Optional: Verify user still exists in DB if needed, but for perf we might skip
        // const user = await findUserById(decoded.id); 
        // if (!user) return res.status(401).json({ message: 'User not found' });

        (req as AuthRequest).user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            departmentId: decoded.departmentId // If available in token
        };
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

export const requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!allowedRoles.includes(authReq.user.role)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};
