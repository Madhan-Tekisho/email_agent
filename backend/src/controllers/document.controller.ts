import { Request, Response } from 'express';
import { IngestionService } from '../services/ingestion.service';
import { AIService } from '../services/ai.service';
import { DocumentModel } from '../models/document.model';
import { DepartmentModel } from '../models/department.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../db';

const ingestionService = new IngestionService();
const aiService = new AIService();

export const DocumentController = {
    upload: async (req: Request, res: Response) => {
        try {
            console.log("Upload Request Received");
            console.log("Headers:", req.headers['content-type']);
            console.log("Body:", req.body);
            console.log("File:", req.file ? `Present (${req.file.originalname})` : "Missing");

            const { dept_id, otp } = req.body;
            const user = (req as AuthRequest).user;

            // OTP Validation for Privileged Users
            // OTP Validation for Privileged Users
            if (user && (user.role === 'SuperAdmin' || user.role === 'DeptHead')) {
                console.log(`[Upload] User: ${user.email}, Role: ${user.role}, OTP: ${otp}`);
                if (!otp) {
                    console.error("Missing OTP for privileged user");
                    return res.status(403).json({ error: "OTP required for privileged upload" });
                }

                const { data: otpData, error: otpError } = await supabase
                    .from('otp_codes')
                    .select('*')
                    .eq('email', user.email)
                    .eq('otp', otp)
                    .gt('expires_at', new Date().toISOString())
                    .single();

                if (otpError || !otpData) {
                    console.error(`OTP Fail. Error: ${otpError?.message}, Data: ${JSON.stringify(otpData)}`);
                    return res.status(403).json({ error: "Invalid or expired OTP" });
                }

                // Consume OTP
                await supabase.from('otp_codes').delete().eq('email', user.email).eq('otp', otp);
            }

            const file = req.file;

            if (!file) return res.status(400).send("No file");

            // Check for duplicate
            const existing = await DocumentModel.findByTitle(file.originalname);
            if (existing) {
                return res.status(409).json({ error: `Document "${file.originalname}" already exists.` });
            }

            const text = await ingestionService.parseFile(file.buffer, file.mimetype);

            // Indexing first or DB first? Server.ts did parse -> insert -> index.

            const kbDoc = await DocumentModel.create({
                title: file.originalname,
                dept_id,
                file_type: 'pdf',
                doc_type: 'policy',
                storage_url: 'mock_url',
                content: text
            });

            // Get Dept Name
            const dept = await DepartmentModel.getById(dept_id);
            const deptName = dept?.name || 'Other';

            const chunks = ingestionService.chunkText(text);

            for (const chunk of chunks) {
                await aiService.indexContent(chunk, {
                    department: deptName,
                    filename: file.originalname
                });
            }

            res.json({ success: true, chunks: chunks.length });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    getContent: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const doc = await DocumentModel.getById(id);

            if (!doc) {
                return res.status(404).json({ error: "Document not found" });
            }

            // Return the content (text)
            res.json({
                id: doc.id,
                title: doc.metadata?.title || 'Untitled',
                content: doc.content,
                department: doc.department_id // Basic info
            });
        } catch (e: any) {
            console.error("Get Content Failed", e);
            res.status(500).json({ error: e.message });
        }
    },

    list: async (req: Request, res: Response) => {
        try {
            const docs = await DocumentModel.getAll();

            // Fetch department names mapping efficiently if needed, or join in query. 
            // For now assuming we can fetch depts separately or just return IDs.
            // Let's get depts to map names.
            const depts = await DepartmentModel.getAll();
            const deptMap: Record<string, string> = {};
            depts.forEach((d: any) => deptMap[d.id] = d.name);

            const result = docs?.map((doc: any) => ({
                id: doc.id,
                title: doc.metadata?.title || 'Untitled',
                department: deptMap[doc.department_id] || 'Unknown',
                uploadDate: new Date(doc.created_at).toISOString().split('T')[0],
                usageCount: doc.metadata?.usage_count || 0, // Assuming usage_count might exist or default 0
                qualityScore: 100 // Mock/Default for now if not calculated
            })) || [];

            res.json(result);
        } catch (e: any) {
            console.error("List Documents Failed", e);
            res.status(500).json({ error: e.message });
        }
    },

    reassign: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { target_department_id } = req.body;

            if (!target_department_id) {
                return res.status(400).json({ error: "Target department ID is required" });
            }

            // 1. Get current document
            const doc = await DocumentModel.getById(id);
            if (!doc) {
                return res.status(404).json({ error: "Document not found" });
            }

            const oldDept = await DepartmentModel.getById(doc.department_id);
            const oldDeptName = oldDept?.name || 'Other';

            // 2. Update DB
            await DocumentModel.updateDepartment(id, target_department_id);

            // 3. Get new department name
            const newDept = await DepartmentModel.getById(target_department_id);
            const newDeptName = newDept?.name || 'Other';

            // 4. Sync Vector DB (Delete old vectors, Re-index)
            const title = doc.metadata?.title;
            if (title) {
                // Delete vectors for this file in the old department
                await aiService.deleteVectors({
                    filename: { $eq: title },
                    department: { $eq: oldDeptName }
                });

                // Re-index
                // We need the content. If content is in DB, use it.
                if (doc.content) {
                    const chunks = ingestionService.chunkText(doc.content);
                    for (const chunk of chunks) {
                        await aiService.indexContent(chunk, {
                            department: newDeptName,
                            filename: title
                        });
                    }
                }
            }

            res.json({ success: true, message: `Document reassigned from ${oldDeptName} to ${newDeptName}` });

        } catch (e: any) {
            console.error("Reassign Failed", e);
            res.status(500).json({ error: e.message });
        }
    }
};
