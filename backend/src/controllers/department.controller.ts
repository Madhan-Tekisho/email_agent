import { Request, Response } from 'express';
import { DepartmentModel } from '../models/department.model';

export const DepartmentController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const depts = await DepartmentModel.getAll();
            res.json(depts);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    updateHead: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { head_name, head_email } = req.body;

        if (!head_name || !head_email) {
            return res.status(400).json({ error: "head_name and head_email are required" });
        }

        try {
            await DepartmentModel.updateHead(id, head_name, head_email);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    getHistory: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const history = await DepartmentModel.getHistory(id);
            res.json(history);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    getHistoryStats: async (req: Request, res: Response) => {
        const { head_email, start_date, end_date } = req.body;

        if (!head_email || !start_date || !end_date) {
            return res.status(400).json({ error: "Missing required fields: head_email, start_date, end_date" });
        }

        try {
            const stats = await DepartmentModel.getHeadStats(head_email, start_date, end_date);
            res.json(stats);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

};
