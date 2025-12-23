import { supabase } from './index';

const departments = [
    {
        name: "Human Resources",
        code: "HR",
        description: "Leaves, payroll, holidays, workplace harassment, benefits, and joining formalities.",
        head_name: "Abhishek",
        head_email: "abhishektekisho@gmail.com"
    },
    {
        name: "Accounting and Finance",
        code: "FIN",
        description: "Invoices, reimbursements, tax, budget approvals, and vendor payments.",
        head_name: "Isha",
        head_email: "ishareddy1w@gmail.com"
    },
    {
        name: "Operations",
        code: "OPS",
        description: "Logistics, transport, facility management, IT assets, and safety compliance.",
        head_name: "Sivajanya",
        head_email: "sivajanyatripurasetti@gmail.com"
    },
    {
        name: "Sales",
        code: "SALES",
        description: "Customer deals, pricing discounts, CRM access, and sales targets.",
        head_name: "Madhan",
        head_email: "madhank1780@gmail.com"
    },
    {
        name: "Customer Support",
        code: "SUP",
        description: "Ticket escalation, customer complaints, and service level agreements (SLA).",
        head_name: "Shubham Sai",
        head_email: "shubham.sai1327@gmail.com"
    }
];

const seed = async () => {
    try {
        console.log("Seeding departments...");

        const { error } = await supabase
            .from('departments')
            .upsert(departments, { onConflict: 'name' });

        if (error) {
            console.error("Seeding failed:", error);
            process.exit(1);
        }

        console.log("Seeding complete.");
        process.exit(0);
    } catch (e) {
        console.error("Seeding failed (unexpected):", e);
        process.exit(1);
    }
};

seed();
