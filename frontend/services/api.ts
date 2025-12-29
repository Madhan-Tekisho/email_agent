
import { EmailData, EmailStatus, Priority, Intent, Department } from '../types';

const API_BASE = '/api';

interface BackendEmail {
    id: number;
    subject: string;
    status: string;
    confidence: number;
    body_text: string;
    generated_reply: string | null;
    from_email: string;
    dept_name: string | null;
    created_at: string;
    priority?: string;
    intent?: string;
    token_used?: number;
    cc?: string[];
}

export const api = {
    async getEmails(): Promise<{ emails: EmailData[], metrics: any }> {
        const response = await fetch(`${API_BASE}/emails`);
        if (!response.ok) throw new Error('Failed to fetch emails');
        const data = await response.json();
        const rows: BackendEmail[] = data.emails || [];

        const emails = rows.map(row => ({
            id: String(row.id),
            companyId: 'comp-1', // Default
            sender: row.from_email,
            subject: row.subject,
            body: row.body_text,
            receivedAt: row.created_at, // Real DB timestamp
            department: (row.dept_name as Department) || Department.SUPPORT, // Map or default
            priority: capitalize(row.priority) as Priority || Priority.MEDIUM,
            intent: (row.intent as Intent) || Intent.REQUEST,
            confidenceScore: Math.round((row.confidence || 0) * 100),
            status: mapStatus(row.status),
            suggestedResponse: row.generated_reply || undefined,
            tokenUsed: row.token_used || 0,
            cc: row.cc || [],
            history: []
        }));

        return { emails, metrics: data.metrics };
    },

    async approveEmail(id: string): Promise<void> {
        await fetch(`${API_BASE}/emails/${id}/approve`, { method: 'POST' });
    },

    async rejectEmail(id: string): Promise<void> {
        await fetch(`${API_BASE}/emails/${id}/reject`, { method: 'POST' });
    },

    async batchProcess(emailIds: string[], action: 'approve' | 'reject'): Promise<{ success: boolean; processed: number; failed?: number }> {
        const res = await fetch(`${API_BASE}/emails/batch/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailIds, action })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Batch process failed');
        }
        return res.json();
    },

    async uploadDocument(file: File, deptId: string, otp?: string): Promise<{ success: boolean; chunks: number }> {
        console.log("api.uploadDocument:", file);
        const formData = new FormData();
        formData.append('dept_id', deptId);
        if (otp) formData.append('otp', otp);
        formData.append('file', file);

        console.log("FormData created. File size:", file.size);
        const res = await fetch(`${API_BASE}/documents`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Upload failed with status ${res.status}`);
        }
        return res.json();
    },

    async getDocumentContent(id: string): Promise<{ id: string; title: string; content: string; department: string }> {
        const res = await fetch(`${API_BASE}/documents/${id}/content`);
        if (!res.ok) throw new Error('Failed to fetch document content');
        return res.json();
    },

    async getDocuments(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/documents`);
        if (!res.ok) throw new Error('Failed to fetch documents');
        return res.json();
    },

    async reassignDocument(id: string, targetDeptId: string): Promise<void> {
        const res = await fetch(`${API_BASE}/documents/${id}/reassign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_department_id: targetDeptId })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to reassign document');
        }
    },

    async getDepartments(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/departments`);
        return res.json();
    },

    async getRagStats(): Promise<{ totalDocs: number; avgUsage: number; coverageGaps: number; qualityScore: number }> {
        const res = await fetch(`${API_BASE}/rag/stats`);
        if (!res.ok) {
            console.error('Failed to fetch RAG stats');
            return { totalDocs: 0, avgUsage: 0, coverageGaps: 0, qualityScore: 0 };
        }
        return res.json();
    },

    async getAnalyticsOverview(): Promise<any> {
        const res = await fetch(`${API_BASE}/analytics/overview`);
        return res.json();
    },

    async getAnalyticsDepartment(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/analytics/department`);
        return res.json();
    },

    async getAnalyticsTrends(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/analytics/trends`);
        return res.json();
    },

    async getUserStats(email: string): Promise<any> {
        const res = await fetch(`${API_BASE}/analytics/user-stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return res.json();
    },

    async getDepartmentHistory(id: string): Promise<any[]> {
        const res = await fetch(`${API_BASE}/departments/${id}/history`);
        return res.json();
    },

    async getHistoryStats(headEmail: string, startDate: string, endDate: string): Promise<any> {
        const res = await fetch(`${API_BASE}/departments/history/stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ head_email: headEmail, start_date: startDate, end_date: endDate })
        });
        return res.json();
    },

    async updateDepartmentHead(id: string, headName: string, headEmail: string): Promise<void> {
        const res = await fetch(`${API_BASE}/departments/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ head_name: headName, head_email: headEmail })
        });
        if (!res.ok) throw new Error('Failed to update department head');
    },

    async login(email: string, password: string): Promise<any> {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const text = await res.text();
        try {
            const data = JSON.parse(text);
            if (!res.ok) {
                throw new Error(data.message || 'Login failed');
            }
            return data;
        } catch (e: any) {
            // If manual throw above, rethrow
            if (e.message !== 'Unexpected end of JSON input' && !e.message.includes('JSON')) {
                throw e;
            }
            throw new Error(`Server Error (${res.status}): ${text || 'Empty response'}`);
        }
    },

    async register(email: string, password: string, name: string): Promise<any> {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        const text = await res.text();
        try {
            const data = JSON.parse(text);
            if (!res.ok) {
                throw new Error(data.message || 'Registration failed');
            }
            return data;
        } catch (e: any) {
            if (e.message !== 'Unexpected end of JSON input' && !e.message.includes('JSON')) {
                throw e;
            }
            throw new Error(`Server Error (${res.status}): ${text || 'Empty response'}`);
        }
    },

    async getCurrentUser(token: string): Promise<any> {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const text = await res.text();
        try {
            const data = JSON.parse(text);
            if (!res.ok) {
                throw new Error(data.message || 'Invalid token');
            }
            return data;
        } catch (e) {
            console.error("Token validation error:", text);
            throw new Error('Invalid token response');
        }
    },

    async toggleAgentStatus(active: boolean): Promise<{ success: boolean; isActive: boolean }> {
        const res = await fetch(`${API_BASE}/system/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active })
        });
        if (!res.ok) throw new Error('Failed to toggle status');
        return res.json();
    },

    async forgotPassword(email: string): Promise<any> {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to send OTP');
        }
        return res.json();
    },

    async verifyOtp(email: string, otp: string): Promise<any> {
        const res = await fetch(`${API_BASE}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Invalid OTP');
        }
        return res.json();
    },

    async resetPassword(email: string, otp: string, newPassword: string): Promise<any> {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, newPassword })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to reset password');
        }
        return res.json();
    },

    async requestUploadOtp(email: string): Promise<any> {
        const res = await fetch(`${API_BASE}/auth/request-upload-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to send OTP');
        }
        return res.json();
    }
};

function mapStatus(backendStatus: string): EmailStatus {
    // Map backend status strings to frontend enum
    switch (backendStatus) {
        case 'needs_review': return EmailStatus.NEEDS_REVIEW;
        case 'pending': return EmailStatus.PENDING;
        case 'human_answered': return EmailStatus.SENT;
        case 'rag_answered': return EmailStatus.AUTO_RESOLVED;
        case 'fallback_sent': return EmailStatus.SENT;
        case 'archived': return EmailStatus.AUTO_RESOLVED;
        case 'processing': return EmailStatus.PROCESSING;
        default: return EmailStatus.NEW; // Fallback to NEW for unknown statuses
    }
}

function capitalize(s?: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
