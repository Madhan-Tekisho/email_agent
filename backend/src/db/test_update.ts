
import { DepartmentModel } from '../models/department.model';
import { supabase } from './index';

const runTest = async () => {
    try {
        console.log("Testing DepartmentModel.updateHead...");

        // 1. Get a department ID
        const { data: dept, error } = await supabase
            .from('departments')
            .select('id, name, head_name, head_email')
            .limit(1)
            .single();

        if (error || !dept) {
            console.error("No departments found to test or error fetching:", error);
            process.exit(1);
        }

        console.log("Testing with department:", dept);

        // 2. Try update
        await DepartmentModel.updateHead(dept.id, "Test Head", "test@acme.corp");

        console.log("Update successful!");

        // 3. Revert
        await DepartmentModel.updateHead(dept.id, dept.head_name, dept.head_email);
        console.log("Revert successful!");

        process.exit(0);
    } catch (e: any) {
        console.error("Test failed!");
        console.error("Message:", e.message);
        process.exit(1);
    }
};

runTest();
