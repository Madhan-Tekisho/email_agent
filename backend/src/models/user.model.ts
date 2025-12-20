import { query } from '../db';

export interface User {
    id: string;
    user_email: string;
    name?: string;
    role: string;
    created_at: Date;
    department_id?: string;
    password_hash?: string;
}

export const createUser = async (email: string, passwordHash: string, name?: string, role: string = 'employee', departmentId?: string): Promise<User> => {
    const result = await query(
        `INSERT INTO users (user_email, password_hash, name, role, department_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [email, passwordHash, name, role, departmentId]
    );
    return result.rows[0];
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
    const result = await query(
        `SELECT * FROM users WHERE user_email = $1`,
        [email]
    );
    return result.rows[0] || null;
};

export const findUserById = async (id: string): Promise<User | null> => {
    const result = await query(
        `SELECT * FROM users WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
};
