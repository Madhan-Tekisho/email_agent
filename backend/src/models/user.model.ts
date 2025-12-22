import { supabase } from '../db';

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
    const { data, error } = await supabase
        .from('users')
        .insert({
            user_email: email,
            password_hash: passwordHash,
            name,
            role,
            department_id: departmentId
        })
        .select()
        .single();

    if (error) {
        console.error('createUser error:', error);
        throw error;
    }

    return data;
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_email', email)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('findUserByEmail error:', error);
        return null;
    }

    return data || null;
};

export const findUserById = async (id: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('findUserById error:', error);
        return null;
    }

    return data || null;
};
