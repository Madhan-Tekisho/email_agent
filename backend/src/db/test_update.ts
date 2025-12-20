
import { DepartmentModel } from '../models/department.model';
import { query } from '../db';

const runTest = async () => {
    try {
        console.log("Testing DepartmentModel.updateHead...");

        // 1. Get a department ID
        const res = await query("SELECT id, name, head_name, head_email FROM departments LIMIT 1");
        if (res.rows.length === 0) {
            console.error("No departments found to test.");
            process.exit(1);
        }
        const dept = res.rows[0];
        console.log("Testing with department:", dept);

        // 2. Try update
        await DepartmentModel.updateHead(dept.id, "Test Head", "test@acme.corp");

        console.log("Update successful!");

        // 3. Revert
        await DepartmentModel.updateHead(dept.id, dept.head_name, dept.head_email);
        console.log("Revert successful!");

        console.log("Revert successful!");

        process.exit(0);
    } catch (e: any) {
        console.error("Test failed!");
        console.error("Message:", e.message);
        console.error("Code:", e.code);
        console.error("Detail:", e.detail);
        process.exit(1);
    }
};

runTest();
