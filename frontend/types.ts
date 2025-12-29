export const Priority = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

export const Department = {
  SALES: 'Sales',
  HR: 'Human Resources',
  SUPPORT: 'Customer Support',
  FINANCE: 'Accounting and Finance',
  OPERATIONS: 'Operations',
  LEGAL: 'Legal',
  IT: 'IT'
};

export const EmailStatus = {
  NEW: 'New',
  PENDING: 'Pending',
  NEEDS_REVIEW: 'Needs Review',
  PROCESSING: 'In Progress',
  DRAFTED: 'Drafted',
  SENT: 'Sent',
  HUMAN_ANSWERED: 'Human Replied',
  AI_ANSWERED: 'AI Replied',
  SLA_WARNING: 'SLA Warning',
  SLA_BREACHED: 'SLA Breached',
  ESCALATED: 'Escalated',
  AUTO_RESOLVED: 'Auto-Resolved',
  MANUAL_REVIEW: 'Manual Review'
};

export const Intent = {
  REQUEST: 'Request',
  INCIDENT: 'Incident',
  PROBLEM: 'Problem',
  CHANGE: 'Change'
};

export type Priority = typeof Priority[keyof typeof Priority];
export type Department = typeof Department[keyof typeof Department];
export type EmailStatus = typeof EmailStatus[keyof typeof EmailStatus];
export type Intent = typeof Intent[keyof typeof Intent];

export interface DocumentItem {
  id: string;
  title: string;
  department: Department;
  content: string;
  uploadDate: string;
  usageCount: number;
  qualityScore: number;
}

export interface Citation {
  source: string;
  usageCount: number;
}

export interface EmailHistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details?: string;
}

export interface EmailData {
  id: string;
  companyId: string;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string; // ISO String
  department: Department;
  priority: Priority;
  intent: Intent;
  confidenceScore: number;
  status: EmailStatus;
  suggestedResponse?: string;
  citations?: Citation[];
  cc?: string[];
  tokenUsed?: number;
  history: EmailHistoryEvent[];
  feedback?: 'positive' | 'negative' | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  role: 'SuperAdmin' | 'Admin' | 'User' | 'DeptHead';
  departmentName?: string;
  departmentId?: string;
}

export interface RagStats {
  totalDocs: number;
  avgUsage: number;
  coverageGaps: number;
  qualityScore: number;
}