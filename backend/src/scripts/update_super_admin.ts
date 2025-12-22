
import { supabase } from '../db';
import bcrypt from 'bcryptjs';

const updateSuperAdmin = async () => {
    const newEmail = 'rajkiranrao205@gmail.com';
    const newPassword = '12345678';

    try {
        console.log("Updating Super Admin credentials...");

        // 1. Is there already a user with the target email?
        const { data: targetUser, error: targetError } = await supabase
            .from('users')
            .select('id')
            .eq('user_email', newEmail)
            .single();

        const hash = await bcrypt.hash(newPassword, 10);

        if (targetUser) {
            console.log(`User ${newEmail} exists. Promoting to SuperAdmin and updating password.`);
            const { error } = await supabase
                .from('users')
                .update({ role: 'SuperAdmin', password_hash: hash })
                .eq('user_email', newEmail);
            if (error) throw error;
        } else {
            // 2. Is there an old super admin to rename?
            const { data: oldAdmin, error: oldError } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'SuperAdmin')
                .limit(1)
                .single();

            if (oldAdmin) {
                console.log(`Found existing SuperAdmin. Updating email to ${newEmail} and setting new password.`);
                const { error } = await supabase
                    .from('users')
                    .update({ user_email: newEmail, password_hash: hash })
                    .eq('id', oldAdmin.id);
                if (error) throw error;
            } else {
                // 3. Create fresh
                console.log(`Creating new SuperAdmin ${newEmail}`);
                const { error } = await supabase
                    .from('users')
                    .insert({
                        user_email: newEmail,
                        password_hash: hash,
                        name: 'Super Admin',
                        role: 'SuperAdmin'
                    });
                if (error) throw error;
            }
        }

        console.log("Super Admin updated successfully.");
        process.exit(0);

    } catch (e) {
        console.error("Failed to update Super Admin:", e);
        process.exit(1);
    }
};

updateSuperAdmin();
