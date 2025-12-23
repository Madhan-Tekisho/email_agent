
import { supabase } from '../db';
import bcrypt from 'bcryptjs';

const seedSuperAdmin = async () => {
    const email = 'madhan123@example.com';
    const password = '12345678';
    const name = 'madhan';

    try {
        console.log(`Checking for existing SuperAdmin: ${email}`);

        const { data: existing, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('user_email', email)
            .single();

        if (existing) {
            console.log('User already exists. Updating role to SuperAdmin...');
            const { error: updateError } = await supabase
                .from('users')
                .update({ role: 'SuperAdmin', name })
                .eq('user_email', email);

            if (updateError) throw updateError;
            console.log('Role updated to SuperAdmin.');
        } else {
            console.log('Creating new SuperAdmin...');
            const hash = await bcrypt.hash(password, 10);

            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    user_email: email,
                    password_hash: hash,
                    name,
                    role: 'SuperAdmin'
                });

            if (insertError) throw insertError;
            console.log(`SuperAdmin created successfully.\nEmail: ${email}\nPassword: ${password}`);
        }
        process.exit(0);
    } catch (e) {
        console.error('Failed to seed SuperAdmin:', e);
        process.exit(1);
    }
};

seedSuperAdmin();
