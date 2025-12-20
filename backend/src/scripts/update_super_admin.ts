
import { query } from '../db';
import bcrypt from 'bcryptjs';

const updateSuperAdmin = async () => {
    const newEmail = 'rajkiranrao205@gmail.com';
    const newPassword = '12345678';

    // We look for the existing super admin or the user we want to promote/update
    // Strategy: Find ANY SuperAdmin, or find this specific email, or fallback to the previous 'superadmin@mailguard.ai'

    try {
        console.log("Updating Super Admin credentials...");

        // 1. Is there already a user with the target email?
        const targetUserRes = await query("SELECT id FROM users WHERE user_email = $1", [newEmail]);

        const hash = await bcrypt.hash(newPassword, 10);

        if (targetUserRes.rows.length > 0) {
            console.log(`User ${newEmail} exists. Promoting to SuperAdmin and updating password.`);
            await query(
                "UPDATE users SET role = 'SuperAdmin', password_hash = $1 WHERE user_email = $2",
                [hash, newEmail]
            );
        } else {
            // 2. Is there an old super admin to rename?
            const oldAdminRes = await query("SELECT id FROM users WHERE role = 'SuperAdmin' LIMIT 1");
            if (oldAdminRes.rows.length > 0) {
                console.log(`Found existing SuperAdmin. Updating email to ${newEmail} and setting new password.`);
                await query(
                    "UPDATE users SET user_email = $1, password_hash = $2 WHERE id = $3",
                    [newEmail, hash, oldAdminRes.rows[0].id]
                );
            } else {
                // 3. Create fresh
                console.log(`Creating new SuperAdmin ${newEmail}`);
                await query(
                    `INSERT INTO users (user_email, password_hash, name, role) 
                     VALUES ($1, $2, 'Super Admin', 'SuperAdmin')`,
                    [newEmail, hash]
                );
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
