
import { query } from '../db';
import bcrypt from 'bcryptjs';

const seedSuperAdmin = async () => {
    const email = 'superadmin@mailguard.ai';
    const password = 'SuperSecret123!';
    const name = 'System Administrator';

    try {
        console.log(`Checking for existing SuperAdmin: ${email}`);
        const existing = await query('SELECT id FROM users WHERE user_email = $1', [email]);

        if (existing.rows.length > 0) {
            console.log('SuperAdmin already exists. Updating role to be sure...');
            await query("UPDATE users SET role = 'SuperAdmin' WHERE user_email = $1", [email]);
            console.log('Role updated.');
        } else {
            console.log('Creating new SuperAdmin...');
            const hash = await bcrypt.hash(password, 10);
            await query(
                `INSERT INTO users (user_email, password_hash, name, role) 
                 VALUES ($1, $2, $3, 'SuperAdmin')`,
                [email, hash, name]
            );
            console.log(`SuperAdmin created successfully.\nEmail: ${email}\nPassword: ${password}`);
        }
        process.exit(0);
    } catch (e) {
        console.error('Failed to seed SuperAdmin:', e);
        process.exit(1);
    }
};

seedSuperAdmin();
