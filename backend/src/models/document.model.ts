import { supabase } from '../db';

export const DocumentModel = {
    create: async (data: { title: string, dept_id: string, doc_type: string, storage_url: string, file_type: string, uploader_id?: string, status?: string, uploader_role?: string, content?: string }) => {
        const metadata = {
            title: data.title,
            storage_url: data.storage_url,
            file_type: data.file_type,
            uploader_id: data.uploader_id,
            status: data.status
        };

        const { data: result, error } = await supabase
            .from('kb_documents')
            .insert({
                department_id: data.dept_id,
                content: data.content || '',
                doc_type: data.doc_type || 'policy',
                metadata
            })
            .select('id')
            .single();

        if (error) {
            console.error('DocumentModel.create error:', error);
            throw error;
        }

        return result;
    },

    getById: async (id: string) => {
        const { data, error } = await supabase
            .from('kb_documents')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('DocumentModel.getById error:', error);
            throw error;
        }

        return data;
    },

    findByTitle: async (title: string) => {
        const { data, error } = await supabase
            .from('kb_documents')
            .select('*')
            .filter('metadata->>title', 'ilike', title)
            .maybeSingle();

        if (error) {
            console.error('DocumentModel.findByTitle error:', error);
            return null;
        }
        return data;
    },

    getAll: async () => {
        const { data, error } = await supabase
            .from('kb_documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('DocumentModel.getAll error:', error);
            throw error;
        }

        return data;
    },

    updateDepartment: async (id: string, newDeptId: string) => {
        const { data, error } = await supabase
            .from('kb_documents')
            .update({ department_id: newDeptId })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('DocumentModel.updateDepartment error:', error);
            throw error;
        }

        return data;
    }
};
