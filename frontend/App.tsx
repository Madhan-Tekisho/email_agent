import React, { useState, useEffect, useRef } from 'react';
// import { createRoot } from 'react-dom/client'; // Removed
import { Department, EmailData, EmailStatus, Priority, User, DocumentItem, Intent, RagStats } from './types';
import { MOCK_EMAILS, MOCK_DOCUMENTS, COMPANIES, MOCK_RAG_STATS } from './constants';
import Sidebar from './components/Sidebar';
import StatCard from './components/StatCard';
import EmailDetail from './components/EmailDetail';
import AnalyticsView from './components/AnalyticsView';
import ProfileView from './components/ProfileView';
import { classifyEmailWithGemini } from './services/geminiService';
import { api } from './services/api';
import {
  Inbox, AlertCircle, Clock, CheckCircle, RotateCcw,
  BarChart3, Settings, Search, Filter, RefreshCw,
  MoreVertical, ChevronDown, Mail, Download, Share2,
  Trash2, Star, Flag, Paperclip, Minimize2, Maximize2, X,
  FileText, Users, Bot, Zap, Activity, ShieldCheck,
  Building2, Lock, User as UserIcon, LogOut, Save, UserMinus, UserPlus, Sparkles, Calendar, Shield,
  Plus, AlertTriangle, Cpu, CheckCircle2, ArrowRightLeft
} from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard');

  const [emails, setEmails] = useState<EmailData[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [ragStats, setRagStats] = useState<RagStats>(MOCK_RAG_STATS);
  const [agentActive, setAgentActive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [volumeView, setVolumeView] = useState<'Weekly View' | 'Monthly View'>('Weekly View');

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot-password' | 'verify-otp' | 'reset-password'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Forgot Password State
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(COMPANIES[0].id);
  const [backendStats, setBackendStats] = useState<any>(null);

  const [selectedDept, setSelectedDept] = useState<Department | 'All'>('All');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // New Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Configuration State
  const [deptHeads, setDeptHeads] = useState<Record<string, { id: string; name: string; email: string }>>({});

  const [configDept, setConfigDept] = useState<Department>(Department.SALES);
  const [newHead, setNewHead] = useState({ name: '', email: '', id: '' });
  const [configStatus, setConfigStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [selectedHistoryStats, setSelectedHistoryStats] = useState<any | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFileRef = useRef<File | null>(null); // Persist file for OTP flow
  const [dashboardView, setDashboardView] = useState<'stats' | 'pending' | 'resolved' | 'critical' | 'breached' | 'analytics' | 'profile'>('stats');
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());

  // Document Upload State
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>([]);
  const [uploadDeptId, setUploadDeptId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | { name: string; type: string } | null>(null);

  // Reassign State
  const [reassignDoc, setReassignDoc] = useState<DocumentItem | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');

  // OTP Upload State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);

  // --- Effects ---
  // --- Effects ---
  useEffect(() => {
    // Check for token on load
    const token = localStorage.getItem('token');
    if (token) {
      api.getCurrentUser(token)
        .then(({ user: apiUser }) => {
          const company = COMPANIES.find(c => c.id === selectedCompanyId)!;
          setUser({
            id: apiUser.id,
            name: apiUser.name || apiUser.email.split('@')[0],
            email: apiUser.email,
            companyId: company.id,
            companyName: company.name,
            role: apiUser.role,
            departmentName: apiUser.departmentName
          });
        })
        .catch(err => {
          console.error("Token restore failed", err);
          localStorage.removeItem('token');
        });
    }

    // Initial Fetch
    const fetchData = async () => {
      try {
        const { emails: fetchedEmails, metrics } = await api.getEmails();
        setEmails(fetchedEmails);
        setBackendStats(metrics);

        // Fetch Departments
        const depts = await api.getDepartments();
        const headsMap: Record<string, any> = {};
        const deptList: { id: string; name: string }[] = [];
        depts.forEach(d => {
          headsMap[d.name] = { id: String(d.id), name: d.head_name || 'Unassigned', email: d.head_email || 'unassigned@acme.corp' };
          deptList.push({ id: d.id, name: d.name });
        });
        setDeptHeads(headsMap);
        setDepartmentsList(deptList);
        if (deptList.length > 0) {
          setUploadDeptId(deptList[0].id);
        }

        // Fetch Documents
        const docs = await api.getDocuments();
        setDocuments(docs);

        // Fetch RAG Stats
        const ragStatsData = await api.getRagStats();
        setRagStats(ragStatsData);

      } catch (e) {
        console.error("Failed to fetch data", e);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    // Poll for updates if agent is active
    if (!user || !agentActive) return;
    const interval = setInterval(async () => {
      try {
        const { emails: fetched, metrics } = await api.getEmails();
        // Merge or replace logic - for now replace to keep sync
        setEmails(fetched);
        setBackendStats(metrics);
      } catch (e) {
        console.error("Polling failed", e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, agentActive]);

  // --- Actions ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    try {
      const { token, user: apiUser } = await api.login(loginEmail, loginPassword);
      const company = COMPANIES.find(c => c.id === selectedCompanyId)!;

      setUser({
        id: apiUser.id,
        name: apiUser.name || apiUser.email.split('@')[0],
        email: apiUser.email,
        companyId: company.id,
        companyName: company.name,
        role: apiUser.role,
        departmentName: apiUser.departmentName
      });
      localStorage.setItem('token', token);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regName) return;

    try {
      const { token, user: apiUser } = await api.register(regEmail, regPassword, regName);
      const company = COMPANIES.find(c => c.id === selectedCompanyId)!;

      setUser({
        id: apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        companyId: company.id,
        companyName: company.name,
        role: apiUser.role
      });
      localStorage.setItem('token', token);
      alert('Registration successful! You are now logged in.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.forgotPassword(resetEmail);
      alert(`OTP sent to ${resetEmail}`);
      setAuthMode('verify-otp');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.verifyOtp(resetEmail, resetOtp);
      setAuthMode('reset-password');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.resetPassword(resetEmail, resetOtp, newPassword);
      alert('Password reset successfully. Please login.');
      setAuthMode('login');
      setLoginEmail(resetEmail);
      setLoginPassword('');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSimulateIncoming = async () => {
    if (!user) return;
    const subjects = ["Access Denied: Production", "Invoice Mismatch #992", "Policy Update Request", "Critical System Failure"];
    const bodies = ["Unable to access node-7. Please investigate.", "Vendor claims $5k discrepancy.", "HR policy for remote work needs update.", "500 Errors on gateway."];
    const randomIdx = Math.floor(Math.random() * subjects.length);
    const newId = `e-${Date.now()}`;

    const placeholderEmail: EmailData = {
      id: newId, companyId: user.companyId, sender: 'alert@system.monitor', subject: subjects[randomIdx], body: bodies[randomIdx], receivedAt: new Date().toISOString(),
      department: Department.SUPPORT, priority: Priority.LOW, intent: Intent.REQUEST, confidenceScore: 0, status: EmailStatus.PROCESSING,
      history: [{ id: `h-${Date.now()}`, timestamp: new Date().toISOString(), action: 'Ingested', actor: 'System' }]
    };

    setEmails(prev => [placeholderEmail, ...prev]);
    const classification = await classifyEmailWithGemini(placeholderEmail.subject, placeholderEmail.body);
    setEmails(prev => prev.map(e => e.id === newId ? { ...e, ...classification, status: EmailStatus.NEW, history: [...e.history, { id: `h-${Date.now()}_ai`, timestamp: new Date().toISOString(), action: 'Classified', actor: 'AI Core', details: `Intent: ${classification.intent} (${classification.confidence}%)` }] } : e));
  };

  const handleSendResponse = async (emailId: string, content: string) => {
    try {
      await api.approveEmail(emailId);
      // Optimistic update
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, status: EmailStatus.SENT, suggestedResponse: content, history: [...e.history, { id: `h-${Date.now()}`, timestamp: new Date().toISOString(), action: 'Responded', actor: user?.name || 'User' }] } : e));
      setSelectedEmailId(null);
    } catch (e) {
      console.error("Failed to approve", e);
      alert("Failed to send response");
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['ID', 'Department', 'Subject', 'Priority', 'Confidence', 'Status', 'From', 'Received At'].join(','),
      ...emails.map(e => [e.id, e.department, `"${e.subject}"`, e.priority, e.confidenceScore, e.status, e.sender, e.receivedAt].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailguard-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const { emails: fetchedEmails, metrics } = await api.getEmails();
      setEmails(fetchedEmails);
      setBackendStats(metrics);

      // Also refresh departments
      const depts = await api.getDepartments();
      const headsMap: Record<string, any> = {};
      depts.forEach(d => {
        headsMap[d.name] = { id: String(d.id), name: d.head_name || 'Unassigned', email: d.head_email || 'unassigned@acme.corp' };
      });
      setDeptHeads(headsMap);

      console.log("Dashboard refreshed successfully");
    } catch (e) {
      console.error("Failed to refresh data", e);
      alert("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleAgent = async () => {
    try {
      const newState = !agentActive;
      await api.toggleAgentStatus(newState);
      setAgentActive(newState);
    } catch (e: any) {
      console.error("Failed to toggle agent status", e);
      alert("Failed to toggle AI Agent status");
    }
  };


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (!uploadDeptId) {
      alert("Please select a department first.");
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Reset input so change event triggers again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmUpload = async () => {
    // If we have content but no raw file (existing doc preview), this button shouldn't be here or should be hidden
    if (!selectedFile || !uploadDeptId || !('size' in selectedFile)) return;

    // Store file in ref to persist through modal interactions
    uploadFileRef.current = selectedFile as File;

    // Privileged Role Check
    if (user && ['SuperAdmin', 'DeptHead'].includes(user.role)) {
      try {
        setIsRequestingOtp(true);
        await api.requestUploadOtp(user.email);
        setShowOtpModal(true);
        setOtpValue('');
      } catch (e: any) {
        alert("Failed to request OTP: " + e.message);
      } finally {
        setIsRequestingOtp(false);
      }
      return;
    }

    await performUpload(selectedFile as File, uploadDeptId);
  };

  const performUpload = async (file: File, deptId: string, otp?: string) => {
    console.log("performUpload called with:", file, deptId, otp);
    if (!file) {
      console.error("performUpload: File is missing/null");
      alert("Internal Error: No file selected");
      return;
    }

    setIsUploading(true);
    try {
      const result = await api.uploadDocument(file, deptId, otp);
      const deptName = departmentsList.find(d => d.id === deptId)?.name || 'Unknown';
      alert(`Document uploaded successfully to ${deptName}!\n${result.chunks} chunks indexed.`);
      // Clear preview
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setSelectedFile(null);
      setShowOtpModal(false);
    } catch (err: any) {
      console.error("Upload failed", err);
      // Handle known 409 error structure or text
      if (err.message && (err.message.includes("409") || err.message.includes("already exists"))) {
        alert("Duplicate Error: This document already exists!");
      } else {
        alert(err.message || "Failed to upload document.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const cancelUpload = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewContent(null);
    setSelectedFile(null);
  };

  const handleDocumentClick = async (docId: string) => {
    setIsUploading(true);
    try {
      const data = await api.getDocumentContent(docId);
      setPreviewContent(data.content);
      setSelectedFile({ name: data.title, type: 'text/plain' } as File);
      setPreviewUrl(null);
    } catch (e) {
      console.error("Failed to load doc", e);
      alert("Failed to load document content");
    } finally {
      setIsUploading(false);
    }
  };



  const handleUpdateHead = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigStatus(null);

    // Validation
    if (!newHead.name || !newHead.email || !newHead.id) {
      return;
    }

    const oldHead = deptHeads[configDept];
    // Optimistic Update
    setDeptHeads(prev => ({
      ...prev,
      [configDept]: { ...newHead }
    }));

    try {
      // Find ID of dept to update
      const depts = await api.getDepartments();
      const dept = depts.find(d => d.name === configDept);
      if (dept) {
        await api.updateDepartmentHead(dept.id, newHead.name, newHead.email);
        setConfigStatus({
          success: true,
          message: `Success: Updated ${configDept} head to ${newHead.name}.`
        });

        // Refresh history if we updated the currently viewed department
        if (showHistory) {
          const history = await api.getDepartmentHistory(dept.id);
          setHistoryData(history || []);
        }
      }
    } catch (err: any) {
      console.error(err);
      // Revert on failure
      setDeptHeads(prev => ({ ...prev, [configDept]: oldHead }));
      setConfigStatus({ success: false, message: 'Failed to update department head.' });
    }

    setNewHead({ name: '', email: '', id: '' });
  };

  const handleHistoryClick = async (historyItem: any) => {
    try {
      const stats = await api.getHistoryStats(historyItem.head_email, historyItem.start_date, historyItem.end_date);
      setSelectedHistoryStats({ ...stats, headName: historyItem.head_name, startDate: historyItem.start_date, endDate: historyItem.end_date });
      setShowStatsModal(true);
    } catch (e) {
      console.error("Failed to fetch history stats", e);
      // Optionally show alert
    }
  };


  const openReassignModal = (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    setReassignDoc(doc);
    // Set default target to something other than current if possible, or just first in list
    // Find current dept ID
    const currentDeptId = departmentsList.find(d => d.name === doc.department)?.id || '';
    // Default to first dept that isn't current, or just first
    const target = departmentsList.find(d => d.id !== currentDeptId);
    setReassignTargetId(target?.id || (departmentsList[0]?.id || ''));
  };

  const handleConfirmReassign = async () => {
    if (!reassignDoc || !reassignTargetId) return;
    try {
      await api.reassignDocument(reassignDoc.id, reassignTargetId);

      const newDeptName = departmentsList.find(d => d.id === reassignTargetId)?.name || 'Unknown';
      alert(`Document reassigned to ${newDeptName} successfully.`);

      // Update local state
      setDocuments(prev => prev.map(d => d.id === reassignDoc.id ? { ...d, department: newDeptName } : d));
      setReassignDoc(null);
    } catch (e: any) {
      console.error("Reassign failed", e);
      alert(e.message || "Failed to reassign document");
    }
  };

  // --- Renderers ---
  const renderDashboard = () => {

    const stats = {
      total: backendStats?.total || emails.length,
      pending: backendStats?.queue || emails.filter(e => e.status !== EmailStatus.SENT && e.status !== EmailStatus.AUTO_RESOLVED).length,
      autoResolved: backendStats?.sent || emails.filter(e => e.status === EmailStatus.AUTO_RESOLVED).length,
      highPriority: emails.filter(e => e.priority === Priority.HIGH && e.status !== EmailStatus.SENT).length,
      breached: emails.filter(e => e.status === EmailStatus.SLA_BREACHED).length,
    };

    return (
      <div className="space-y-6 animate-fade-in pb-10">
        {/* RAG Stats - Top Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap justify-between gap-6">
          <div title="Total documents currently indexed in the RAG system available for retrieval." className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4 cursor-help group transition-colors hover:bg-slate-50 rounded-lg p-2 -ml-2">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors"><FileText className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.totalDocs}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Indexed Documents</div>
            </div>
          </div>
          <div title="Average number of documents cited per generated email response." className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4 cursor-help group transition-colors hover:bg-slate-50 rounded-lg p-2">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors"><Activity className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.avgUsage}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">Citations / Email</div>
            </div>
          </div>
          <div title="Number of incoming queries where NO relevant documents were found in the Knowledge Base." className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4 cursor-help group transition-colors hover:bg-slate-50 rounded-lg p-2">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 transition-colors"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.coverageGaps}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Missing Info Alerts</div>
            </div>
          </div>
          <div title="Overall confidence score of the AI in the accuracy of its responses based on available context." className="flex items-center gap-4 flex-1 min-w-[150px] cursor-help group transition-colors hover:bg-slate-50 rounded-lg p-2">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors"><CheckCircle2 className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.qualityScore}%</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">AI Accuracy Score</div>
            </div>
          </div>
        </div>

        {/* Operational Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Pending Review"
            value={stats.pending}
            icon={Inbox}
            colorClass="text-slate-600 bg-slate-100"
            subtext="Requires Attention (Click to view)"
            onClick={() => setDashboardView(dashboardView === 'pending' ? 'stats' : 'pending')}
          />
          <StatCard
            title="Auto-Resolved"
            value={stats.autoResolved}
            icon={Bot}
            colorClass="text-emerald-600 bg-emerald-50"
            subtext="AI Handled (Click to view)"
            onClick={() => setDashboardView(dashboardView === 'resolved' ? 'stats' : 'resolved')}
          />
          <StatCard
            title="Critical Tasks"
            value={stats.highPriority}
            icon={AlertTriangle}
            colorClass="text-red-600 bg-red-50"
            subtext="High Priority (Click to view)"
            onClick={() => setDashboardView(dashboardView === 'critical' ? 'stats' : 'critical')}
          />
          <StatCard
            title="SLA Breaches"
            value={stats.breached}
            icon={Clock}
            colorClass="text-amber-600 bg-amber-50"
            subtext="Escalated Cases (Click to view)"
            onClick={() => setDashboardView(dashboardView === 'breached' ? 'stats' : 'breached')}
          />
        </div>

        {/* Dynamic Email List View */}
        {dashboardView !== 'stats' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-fade-in relative transition-all">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                {dashboardView === 'pending' && <Inbox className="w-5 h-5 text-slate-500" />}
                {dashboardView === 'resolved' && <Bot className="w-5 h-5 text-emerald-500" />}
                {dashboardView === 'critical' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                {dashboardView === 'breached' && <Clock className="w-5 h-5 text-amber-500" />}

                {dashboardView === 'pending' && 'Pending Emails'}
                {dashboardView === 'resolved' && 'Auto-Resolved Emails'}
                {dashboardView === 'critical' && 'Critical Priority Emails'}
                {dashboardView === 'breached' && 'SLA Breached Emails'}

                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-600 font-bold">
                  {/* Count logic */}
                  {(() => {
                    if (dashboardView === 'pending') return stats.pending;
                    if (dashboardView === 'resolved') return stats.autoResolved;
                    if (dashboardView === 'critical') return stats.highPriority;
                    if (dashboardView === 'breached') return stats.breached;
                    return 0;
                  })()}
                </span>
              </h3>
              <button onClick={() => setDashboardView('stats')} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              {/* Bulk Actions Bar */}
              {selectedEmailIds.size > 0 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-6 z-50 animate-slide-up border border-slate-700/50">
                  <span className="text-sm font-bold flex items-center gap-2">
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold">{selectedEmailIds.size}</div>
                    Selected
                  </span>
                  <div className="h-4 w-px bg-slate-700"></div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!confirm(`Approve ${selectedEmailIds.size} emails?`)) return;
                        try {
                          await api.batchProcess(Array.from(selectedEmailIds), 'approve');
                          alert('Batch approval successful');
                          setSelectedEmailIds(new Set());
                          handleRefresh();
                        } catch (e: any) {
                          alert('Batch failed: ' + e.message);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Reject/Archive ${selectedEmailIds.size} emails?`)) return;
                        try {
                          await api.batchProcess(Array.from(selectedEmailIds), 'reject');
                          alert('Batch rejection successful');
                          setSelectedEmailIds(new Set());
                          handleRefresh();
                        } catch (e: any) {
                          alert('Batch failed: ' + e.message);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                  <button onClick={() => setSelectedEmailIds(new Set())} className="ml-2 text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
              )}

              <table className="w-full text-left text-sm relative">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wide border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 bg-slate-50 w-10">
                      <input
                        type="checkbox"
                        checked={selectedEmailIds.size > 0 && emails.filter(e => {
                          if (dashboardView === 'pending') return e.status !== EmailStatus.SENT && e.status !== EmailStatus.AUTO_RESOLVED;
                          if (dashboardView === 'resolved') return e.status === EmailStatus.AUTO_RESOLVED;
                          if (dashboardView === 'critical') return e.priority === Priority.HIGH && e.status !== EmailStatus.SENT;
                          return e.status === EmailStatus.SLA_BREACHED;
                        }).every(e => selectedEmailIds.has(e.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const ids = emails
                              .filter(e => {
                                if (dashboardView === 'pending') return e.status !== EmailStatus.SENT && e.status !== EmailStatus.AUTO_RESOLVED;
                                if (dashboardView === 'resolved') return e.status === EmailStatus.AUTO_RESOLVED;
                                if (dashboardView === 'critical') return e.priority === Priority.HIGH && e.status !== EmailStatus.SENT;
                                return e.status === EmailStatus.SLA_BREACHED;
                              })
                              .map(e => e.id);
                            setSelectedEmailIds(new Set(ids));
                          } else {
                            setSelectedEmailIds(new Set());
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 bg-slate-50">Subject</th>
                    <th className="px-4 py-3 bg-slate-50">From</th>
                    <th className="px-4 py-3 bg-slate-50">Dept</th>
                    <th className="px-4 py-3 bg-slate-50">Priority</th>
                    <th className="px-4 py-3 bg-slate-50">Status</th>
                    <th className="px-4 py-3 bg-slate-50">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    let filteredEmails: EmailData[] = [];
                    if (dashboardView === 'pending') {
                      filteredEmails = emails.filter(e => e.status !== EmailStatus.SENT && e.status !== EmailStatus.AUTO_RESOLVED);
                    } else if (dashboardView === 'resolved') {
                      filteredEmails = emails.filter(e => e.status === EmailStatus.AUTO_RESOLVED);
                    } else if (dashboardView === 'critical') {
                      filteredEmails = emails.filter(e => e.priority === Priority.HIGH && e.status !== EmailStatus.SENT);
                    } else if (dashboardView === 'breached') {
                      filteredEmails = emails.filter(e => e.status === EmailStatus.SLA_BREACHED);
                    }

                    if (filteredEmails.length === 0) {
                      return <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">No emails found in this category.</td></tr>;
                    }

                    return filteredEmails.map(email => (
                      <tr key={email.id} className={`hover:bg-blue-50 transition-colors group ${selectedEmailIds.has(email.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEmailIds.has(email.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedEmailIds);
                              if (e.target.checked) newSet.add(email.id);
                              else newSet.delete(email.id);
                              setSelectedEmailIds(newSet);
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 w-1/3 truncate max-w-[200px]" title={email.subject}>{email.subject}</td>
                        <td className="px-4 py-3 text-slate-600 w-48 truncate">{email.sender}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-600">{email.department}</span></td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${email.priority === Priority.HIGH ? 'bg-red-50 text-red-700 border-red-100' : email.priority === Priority.MEDIUM ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                            {email.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            {email.status === EmailStatus.SLA_BREACHED && <Clock className="w-3 h-3 text-red-500" />}
                            {email.status === EmailStatus.AUTO_RESOLVED && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                            {email.status !== EmailStatus.SLA_BREACHED && email.status !== EmailStatus.AUTO_RESOLVED && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                            {email.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedEmailId(email.id)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Charts & Graphs Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trend Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Email Volume Trend</h3>
                <p className="text-xs text-slate-500 mt-1">Incoming traffic over time</p>
              </div>
            </div>
            <div className="relative">
              <select
                value={volumeView}
                onChange={(e) => setVolumeView(e.target.value as any)}
                className="appearance-none bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition-colors"
              >
                <option>Weekly View</option>
                <option>Monthly View</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-3 pointer-events-none" />
            </div>

            <div className="h-64 flex gap-2 px-2 relative mt-6">
              {(() => {
                const now = new Date();
                let chartData: { label: string; count: number }[] = [];

                if (volumeView === 'Weekly View') {
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(now.getDate() - i);
                    const dateStr = d.toLocaleDateString('en-CA');
                    const count = emails.filter(e => {
                      const emailDate = new Date(e.receivedAt);
                      return emailDate.toLocaleDateString('en-CA') === dateStr;
                    }).length;
                    chartData.push({
                      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                      count
                    });
                  }
                } else {
                  for (let i = 3; i >= 0; i--) {
                    const start = new Date();
                    start.setDate(now.getDate() - (i * 7) - 6);
                    const end = new Date();
                    end.setDate(now.getDate() - (i * 7));
                    const count = emails.filter(e => {
                      const emailDate = new Date(e.receivedAt);
                      return emailDate >= start && emailDate <= end;
                    }).length;
                    chartData.push({ label: `W${4 - i}`, count });
                  }
                }

                // Calculate dynamic max (round up to nearest 5 for cleaner scale)
                const rawMax = Math.max(1, ...chartData.map(d => d.count));
                const maxVal = Math.ceil(rawMax / 5) * 5 || 5;
                const tickValues = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];

                return (
                  <>
                    {/* Y-Axis Labels */}
                    <div className="flex flex-col justify-between h-full text-[10px] text-slate-400 font-medium w-6 shrink-0">
                      <span>{tickValues[4]}</span>
                      <span>{tickValues[3]}</span>
                      <span>{tickValues[2]}</span>
                      <span>{tickValues[1]}</span>
                      <span>{tickValues[0]}</span>
                    </div>

                    {/* Chart Area */}
                    <div className="flex-1 relative h-full">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div key={i} className="w-full h-px bg-slate-200"></div>
                        ))}
                      </div>

                      {/* Bars */}
                      <div className="flex items-end justify-around h-full gap-2 relative z-10">
                        {chartData.map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center h-full max-w-[50px]">
                            <div className="w-full h-full flex items-end justify-center group cursor-pointer relative">
                              <div
                                className="w-6 bg-blue-600 rounded-t-md transition-all duration-300 group-hover:bg-blue-700"
                                style={{ height: `${(d.count / maxVal) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                              ></div>
                              {/* Tooltip */}
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-lg">
                                {d.count} Emails
                              </div>
                            </div>
                            <span className="text-[10px] font-medium text-slate-500 mt-1">{d.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Department Load */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm mb-6">Department Workload</h3>
            <div className="space-y-5">
              {Object.values(Department).map(dept => {
                const count = emails.filter(e => e.department === dept).length;
                const total = emails.length || 1;
                const percent = (count / total) * 100;
                return (
                  <div key={dept}>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
                      <span>{dept}</span>
                      <span className="text-slate-900">{count} <span className="text-slate-400 font-normal">({Math.round(percent)}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-slate-800 h-2 rounded-full shadow-sm" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div >

    );
  };

  const renderAnalytics = () => {
    // Calculate Response Quality based on email statuses
    const totalEmails = emails.length || 1;
    const autoResolved = emails.filter(e => e.status === EmailStatus.AUTO_RESOLVED || e.status === EmailStatus.SENT).length;
    const pending = emails.filter(e => e.status === EmailStatus.PENDING || e.status === EmailStatus.NEW).length;
    const review = emails.filter(e => e.status === EmailStatus.NEEDS_REVIEW || e.status === EmailStatus.SLA_BREACHED).length;

    const excellentPercent = Math.round((autoResolved / totalEmails) * 100);
    const pendingPercent = Math.round((pending / totalEmails) * 100);
    const reviewPercent = Math.round((review / totalEmails) * 100);

    // Calculate Priority Breakdown
    const highCount = emails.filter(e => e.priority === Priority.HIGH).length;
    const medCount = emails.filter(e => e.priority === Priority.MEDIUM).length;
    const lowCount = emails.filter(e => e.priority === Priority.LOW).length;
    const maxCount = Math.max(highCount, medCount, lowCount, 1);

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quality Distribution - Using horizontal bars for clarity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm mb-6">Response Quality</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div> Excellent</span>
                  <span>{autoResolved} ({excellentPercent}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div className="h-3 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${excellentPercent}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div> Good</span>
                  <span>{pending} ({pendingPercent}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div className="h-3 rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${pendingPercent}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></div> Needs Review</span>
                  <span>{review} ({reviewPercent}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div className="h-3 rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${reviewPercent}%` }}></div>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <span className="text-3xl font-bold text-emerald-600">{excellentPercent}%</span>
              <p className="text-xs text-slate-500 mt-1">Overall Success Rate</p>
            </div>
          </div>

          {/* Resolution Rates */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm mb-6">Resolution by Department</h3>
            <div className="space-y-4">
              {Object.values(Department).map(dept => {
                const deptEmails = emails.filter(e => e.department === dept);
                const deptTotal = deptEmails.length || 1;
                const deptResolved = deptEmails.filter(e => e.status === EmailStatus.SENT || e.status === EmailStatus.AUTO_RESOLVED).length;
                const resolutionRate = Math.round((deptResolved / deptTotal) * 100);
                const color = resolutionRate >= 80 ? 'bg-emerald-500' : resolutionRate >= 60 ? 'bg-blue-600' : 'bg-amber-500';
                return (
                  <div key={dept}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
                      <span>{dept}</span>
                      <span>{resolutionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${resolutionRate}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority Breakdown - Using proper scaling */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm mb-6">Priority Breakdown</h3>
            <div className="flex items-end justify-around h-44 gap-6 px-2">
              {[
                { label: 'High', count: highCount, color: 'bg-red-500' },
                { label: 'Medium', count: medCount, color: 'bg-amber-500' },
                { label: 'Low', count: lowCount, color: 'bg-emerald-500' }
              ].map(p => {
                const heightPercent = (p.count / maxCount) * 100;
                return (
                  <div key={p.label} className="flex flex-col items-center flex-1">
                    <div className="text-sm font-bold text-slate-700 mb-2">{p.count}</div>
                    <div className="w-full h-32 flex items-end justify-center">
                      <div
                        className={`w-10 ${p.color} rounded-t-md transition-all duration-500 hover:opacity-80`}
                        style={{ height: `${heightPercent}%`, minHeight: p.count > 0 ? '12px' : '0' }}
                      ></div>
                    </div>
                    <div className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wide">{p.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleViewHistory = async () => {
    setShowHistory(true);
    try {
      // Robustly resolve UUID from API instead of relying on potentially overwritten state
      const depts = await api.getDepartments();
      const dept = depts.find((d: any) => d.name === configDept);

      if (!dept) {
        console.error("Department not found for history lookup:", configDept);
        setHistoryData([]);
        return;
      }

      const history = await api.getDepartmentHistory(dept.id);
      if (Array.isArray(history)) {
        setHistoryData(history);
      } else {
        console.error("Invalid history data received:", history);
        setHistoryData([]);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
      setHistoryData([]);
      alert("Failed to fetch history");
    }
  };

  const renderConfiguration = () => {
    // Only allow SuperAdmin
    if (user?.role !== 'SuperAdmin') {
      return (
        <div className="flex flex-col items-center justify-center p-20 animate-fade-in text-center">
          <Shield className="w-16 h-16 text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-slate-500 mt-2">Only Super Administrators can access system configuration.</p>
          <button onClick={() => setView('dashboard')} className="mt-6 text-blue-600 font-bold hover:underline">Return to Dashboard</button>
        </div>
      );
    }
    const currentHead = deptHeads[configDept] || { name: 'Unassigned', email: 'N/A', id: 'N/A' };

    return (
      <div className="max-w-3xl mx-auto animate-fade-in pb-10">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Department Configuration</h2>
                <p className="text-xs text-slate-500 font-medium">Manage department leadership and routing protocols</p>
              </div>
            </div>

            <button onClick={handleViewHistory} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
              <Clock className="w-3.5 h-3.5" /> View History
            </button>
          </div>

          <div className="p-8">
            <div className="mb-8">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Select Department</label>
              <select
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={configDept}
                onChange={(e) => {
                  setConfigDept(e.target.value as Department);
                  setConfigStatus(null);
                  setShowHistory(false);
                }}
              >
                {Object.values(Department).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {showHistory ? (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Historical Records for {configDept}</h3>
                  <button onClick={() => setShowHistory(false)} className="text-xs text-blue-600 hover:underline">Back to Edit</button>
                </div>
                {historyData.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                    <p className="text-slate-500 text-sm font-medium">No historical department head records found for this department.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wide border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Full Name</th>
                          <th className="px-4 py-3">Employee ID</th>
                          <th className="px-4 py-3">Department Name</th>
                          <th className="px-4 py-3">Start Date (Serving From)</th>
                          <th className="px-4 py-3">End Date (Serving To)</th>
                          <th className="px-4 py-3">Total Serving Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyData.map(h => (
                          <tr key={h.id} onClick={() => handleHistoryClick(h)} className="hover:bg-blue-50 cursor-pointer transition-colors group">
                            <td className="px-4 py-3 font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{h.head_name}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">N/A</td>
                            <td className="px-4 py-3 text-slate-900 font-medium">{h.department_name}</td>
                            <td className="px-4 py-3 text-slate-600">{new Date(h.start_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-slate-600">{new Date(h.end_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              {h.duration_days < 1 ? '< 1 day' : `${h.duration_days} days`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                {/* Current Head */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 relative group">
                  <div className="absolute top-0 right-0 p-3 opacity-50">
                    <UserMinus className="w-16 h-16 text-slate-200" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Current Head (Outgoing)</h3>
                  <div className="space-y-3 relative z-10">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Name</p>
                      <p className="text-sm font-bold text-slate-900">{currentHead.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Email</p>
                      <p className="text-sm font-mono text-slate-600">{currentHead.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Employee ID</p>
                      <p className="text-sm font-mono text-slate-600">{currentHead.id}</p>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                      <AlertCircle className="w-3 h-3" /> Will be deactivated
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden md:flex bg-white rounded-full p-2 border border-slate-200 shadow-sm">
                  <UserPlus className="w-5 h-5 text-slate-400" />
                </div>

                {/* New Head Form */}
                <div className="bg-white rounded-xl border-2 border-dashed border-blue-200 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest">New Head (Incoming)</h3>
                  </div>

                  {/* Internal Transfer Option */}
                  <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <label className="block text-[10px] font-bold text-blue-800 uppercase mb-1">Internal Transfer (Auto-fill)</label>
                    <select
                      className="w-full text-xs p-2 rounded border border-blue-200 text-slate-700 focus:outline-none focus:border-blue-500"
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (!selectedId) return;
                        // Find the head from deptHeads values
                        const head = Object.values(deptHeads).find((h: any) => h.id === selectedId) as any;
                        if (head) {
                          setNewHead({ name: head.name, email: head.email, id: head.id });
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select existing department head...</option>
                      {Object.entries(deptHeads)
                        .filter(([deptName]) => deptName !== configDept) // Exclude current dept
                        .map(([deptName, head]: [string, any]) => (
                          <option key={head.id} value={head.id}>
                            {head.name} ({deptName})
                          </option>
                        ))
                      }
                    </select>
                  </div>

                  <form onSubmit={handleUpdateHead} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                      <input
                        required
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400"
                        value={newHead.name}
                        onChange={e => setNewHead({ ...newHead, name: e.target.value })}
                        placeholder="e.g. John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                      <input
                        required
                        type="email"
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400"
                        value={newHead.email}
                        onChange={e => setNewHead({ ...newHead, email: e.target.value })}
                        placeholder="john@acme.corp"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Employee ID</label>
                      <input
                        required
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400"
                        value={newHead.id}
                        onChange={e => setNewHead({ ...newHead, id: e.target.value })}
                        placeholder="e.g. EMP-999"
                      />
                    </div>

                    <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-sm">
                      <Save className="w-4 h-4" /> Confirm Replacement
                    </button>
                  </form>
                </div>
              </div>
            )}

            {configStatus && (
              <div className={`mt-6 p-4 rounded-lg border flex items-start gap-3 animate-fade-in ${configStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {configStatus.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <div className="text-sm font-medium">{configStatus.message}</div>
              </div>
            )}

            {!showHistory && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 mb-2">Audit Log Preview</h4>
                <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                  {'>'} [SYSTEM] Initiating leadership transition protocol...<br />
                  {'>'} [CHECK] Department ID verified: {configDept}<br />
                  {'>'} [AUTH] Admin user validated.<br />
                  {'>'} [READY] Waiting for replacement confirmation...
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    );
  };

  const renderEmailList = () => {
    // Calculate counts
    const deptCounts = emails.reduce((acc, email) => {
      acc[email.department] = (acc[email.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const filtered = emails.filter(e => {
      if (selectedDept !== 'All' && e.department !== selectedDept) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const match = e.subject.toLowerCase().includes(query) ||
          e.sender.toLowerCase().includes(query) ||
          e.body.toLowerCase().includes(query);
        if (!match) return false;
      }

      if (selectedDate) {
        // Convert receivedAt (ISO) to locale date string 'YYYY-MM-DD' for comparison
        const emailDate = new Date(e.receivedAt).toLocaleDateString('en-CA');
        if (emailDate !== selectedDate) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    return (
      <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* List Toolbar */}
        <div className="p-4 border-b border-slate-200 flex gap-4 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              className="w-full bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative min-w-[160px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="date"
              className="w-full bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-medium"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="relative min-w-[220px]">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <select className="w-full bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-8 text-sm focus:outline-none appearance-none font-medium text-slate-700" value={selectedDept} onChange={e => setSelectedDept(e.target.value as any)}>
              <option value="All">All Departments ({emails.length})</option>
              {Object.values(Department).map(d => (
                <option key={d} value={d}>{d} ({deptCounts[d] || 0})</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>
          <button onClick={handleSimulateIncoming} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Simulate
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3 w-32">Department</th>
                <th className="px-6 py-3 w-28">Priority</th>
                <th className="px-6 py-3 w-24">Conf.</th>
                <th className="px-6 py-3 w-36">Status</th>
                <th className="px-6 py-3 w-40 text-right">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(email => (
                <tr key={email.id} onClick={() => setSelectedEmailId(email.id)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`font-semibold text-slate-900 ${email.status === EmailStatus.NEW ? 'text-blue-600' : ''}`}>{email.subject}</span>
                      <span className="text-xs text-slate-500 mt-1 font-medium">{email.sender}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">{email.department}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${email.priority === Priority.HIGH ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{email.priority}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${email.confidenceScore > 80 ? 'bg-emerald-500' : email.confidenceScore > 50 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                      <span className="text-slate-700 font-medium font-mono">{email.confidenceScore}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {email.status === EmailStatus.AUTO_RESOLVED ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><Bot className="w-3 h-3" /> Resolved</span>
                    ) : email.status === EmailStatus.NEW ? (
                      <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> New</span>
                    ) : email.status === EmailStatus.PENDING ? (
                      <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><Clock className="w-3 h-3" /> Pending</span>
                    ) : email.status === EmailStatus.NEEDS_REVIEW ? (
                      <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><AlertCircle className="w-3 h-3" /> Needs Review</span>
                    ) : email.status === EmailStatus.AI_ANSWERED ? (
                      <span className="text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><Sparkles className="w-3 h-3" /> AI Replied</span>
                    ) : email.status === EmailStatus.HUMAN_ANSWERED ? (
                      <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><UserIcon className="w-3 h-3" /> Human Replied</span>
                    ) : (
                      <span className="text-slate-500 text-xs font-medium">{email.status}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500 font-mono text-xs">
                    {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium">No emails found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStatsModal = () => {
    if (!showStatsModal || !selectedHistoryStats) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-6 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full relative">
          <button onClick={() => setShowStatsModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">Performance Summary</h3>
            <p className="text-xs text-slate-500 font-medium">Historical metrics for <span className="text-blue-600 font-bold">{selectedHistoryStats.headName}</span></p>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">{new Date(selectedHistoryStats.startDate).toLocaleDateString()} - {new Date(selectedHistoryStats.endDate).toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <div className="text-2xl font-bold text-slate-900 mb-1">{selectedHistoryStats.ccCount}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CC'd Emails</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
              <div className="text-2xl font-bold text-blue-700 mb-1">{selectedHistoryStats.resolvedCount}</div>
              <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Resolved</div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center col-span-2">
              <div className="text-2xl font-bold text-amber-700 mb-1">{selectedHistoryStats.pendingCount}</div>
              <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Pending / Needs Review (During Tenure)</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Main Render ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">

        <div className="max-w-md w-full bg-white rounded-xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-900 text-white rounded-xl mb-4 shadow-lg shadow-slate-900/20">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">EmailQ.AI</h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">Enterprise Access Portal</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${authMode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Create Account
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-6 animate-fade-in">
              <div className="text-center mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                  <Building2 className="w-3 h-3" />
                  Tekisho
                </span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-11 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:text-sm transition duration-150 ease-in-out text-slate-900 font-medium shadow-sm"
                    placeholder="user@company.com"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-11 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:text-sm transition duration-150 ease-in-out text-slate-900 font-medium shadow-sm"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => setAuthMode('forgot-password')} className="text-xs font-bold text-blue-600 hover:text-blue-800">
                  Forgot Password?
                </button>
              </div>
              <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                Authenticate
              </button>
            </form>
          ) : authMode === 'forgot-password' ? (
            <form onSubmit={handleForgotPassword} className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-bold text-center text-slate-800">Reset Password</h2>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  className="block w-full px-4 py-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-600 transition-all text-slate-900 font-medium"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                />
              </div>
              <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md">
                Send OTP
              </button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-slate-500 text-sm font-bold hover:text-slate-800">
                Back to Login
              </button>
            </form>
          ) : authMode === 'verify-otp' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-bold text-center text-slate-800">Verify OTP</h2>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">One-Time Password</label>
                <input
                  type="text"
                  required
                  className="block w-full px-4 py-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-600 text-center tracking-widest text-lg font-mono text-slate-900"
                  placeholder="123456"
                  value={resetOtp}
                  onChange={e => setResetOtp(e.target.value)}
                />
              </div>
              <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md">
                Verify OTP
              </button>
            </form>
          ) : authMode === 'reset-password' ? (
            <form onSubmit={handleResetPassword} className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-bold text-center text-slate-800">New Password</h2>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Enter New Password</label>
                <input
                  type="password"
                  required
                  className="block w-full px-4 py-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-600 text-slate-900"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <button className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition-all shadow-md">
                Reset Password
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    className="block w-full pl-11 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:text-sm transition duration-150 ease-in-out text-slate-900 font-medium shadow-sm"
                    placeholder="John Doe"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-11 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:text-sm transition duration-150 ease-in-out text-slate-900 font-medium shadow-sm"
                    placeholder="user@company.com"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-11 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:text-sm transition duration-150 ease-in-out text-slate-900 font-medium shadow-sm"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                  />
                </div>
              </div>
              <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                Create Account
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      <Sidebar currentView={view} setView={setView} onLogout={() => setUser(null)} user={user} />

      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-baseline gap-4">
            <h1 className="text-xl font-bold text-slate-900">{view === 'dashboard' ? 'Overview' : view === 'settings' ? 'Configuration' : view.charAt(0).toUpperCase() + view.slice(1)}</h1>
            <span className="text-sm text-slate-300 font-light">|</span>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600 font-semibold">{user.companyName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shadow-sm" title="Total API Tokens Used">
              <Cpu className="w-3.5 h-3.5 text-blue-500" />
              <span>{backendStats?.totalTokens ? backendStats.totalTokens.toLocaleString() : '0'} Tokens</span>
            </div>
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-slate-50 transition-colors text-slate-700 shadow-sm">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={handleRefresh} disabled={isRefreshing} className={`flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-slate-50 transition-colors text-slate-700 shadow-sm ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button onClick={handleToggleAgent} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors ${agentActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              <div className={`w-2 h-2 rounded-full ${agentActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`}></div>
              {agentActive ? 'AI Active' : 'AI Paused'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {view === 'dashboard' && renderDashboard()}
            {view === 'emails' && renderEmailList()}
            {view === 'analytics' && <AnalyticsView />}
            {view === 'profile' && user && <ProfileView user={user} />}
            {view === 'settings' && renderConfiguration()}
            {view === 'documents' && (
              <div className="space-y-6 animate-fade-in">
                {/* RAG Stats Row */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.totalDocs}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Indexed Documents</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Activity className="w-5 h-5" /></div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.avgUsage}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Citations / Email</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.coverageGaps}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missing Info Alerts</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-1 min-w-[150px]">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.qualityScore}%</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Accuracy Score</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4 mt-8">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    All Documents <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{documents.length}</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {documents.map(doc => (
                    <div key={doc.id} onClick={() => handleDocumentClick(doc.id)} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer group hover:border-blue-200 relative">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">{doc.department}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">{doc.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-mono">
                        <span>{doc.id}</span>
                        <span>•</span>
                        <span>{doc.uploadDate}</span>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-500">Usage: <span className="text-slate-900">{doc.usageCount}</span></div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-bold text-emerald-600">{doc.qualityScore}% Score</div>
                          <button
                            onClick={(e) => openReassignModal(e, doc)}
                            title="Reassign Department"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Upload Document Card - Admin/DeptHead only */}
                  {['SuperAdmin', 'Admin', 'DeptHead'].includes(user.role) && (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-blue-400 hover:bg-blue-50/50 transition-all min-h-[200px] p-6">
                      <Plus className="w-8 h-8" />
                      <span className="text-sm font-bold text-slate-600">Upload Document</span>

                      {/* Department Selector */}
                      <div className="w-full max-w-[200px]">
                        <select
                          value={uploadDeptId}
                          onChange={(e) => setUploadDeptId(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {departmentsList.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || !uploadDeptId}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isUploading || !uploadDeptId
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                      >
                        {isUploading ? 'Uploading...' : 'Choose File'}
                      </button>
                      <span className="text-xs font-semibold text-slate-400">PDF, DOCX, TXT</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.docx,.txt"
                  />
                </div>
              </div>
            )}
          </div>
        </div >
      </main >

      {selectedEmailId && (
        <EmailDetail
          email={emails.find(e => e.id === selectedEmailId)!}
          documents={documents}
          onClose={() => setSelectedEmailId(null)}
          onSendResponse={handleSendResponse}
          agentActive={agentActive}
        />
      )}
      {renderStatsModal()}

      {/* Document Preview Modal */}
      {(previewUrl || previewContent) && selectedFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full h-[80vh] flex flex-col relative">
            <button onClick={cancelUpload} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 transition-colors bg-white rounded-full p-1 border border-slate-200">
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">Preview Document</h3>
              <p className="text-sm text-slate-500 font-medium">{previewContent ? 'Viewing content of' : 'Review'} <span className="text-blue-600 font-bold">{selectedFile.name}</span> {previewContent ? '' : 'before uploading'}</p>
            </div>

            <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden relative flex items-center justify-center mb-6">
              {previewUrl && selectedFile.type.startsWith('image/') ? (
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
              ) : previewUrl && selectedFile.type === 'application/pdf' ? (
                <iframe src={previewUrl} className="w-full h-full" title="PDF Preview" />
              ) : previewContent ? (
                <div className="w-full h-full p-8 overflow-y-auto bg-white text-left">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700">{previewContent}</pre>
                </div>
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">Preview not available for this file type.</p>
                  <p className="text-xs text-slate-400 mt-2">({selectedFile.type})</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={cancelUpload}
                className="px-6 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors uppercase tracking-wide"
              >
                Close
              </button>
              {previewUrl && (
                <button
                  onClick={handleConfirmUpload}
                  disabled={isUploading}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-blue-900/10 flex items-center gap-2 transition-all uppercase tracking-wide transform active:scale-95"
                >
                  {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                  {isUploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Reassign Modal */}
      {reassignDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-6 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Reassign Document</h3>
            <p className="text-sm text-slate-500 mb-4">
              Move <span className="font-bold text-slate-700">"{reassignDoc.title}"</span> to a different department.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Target Department</label>
              <select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {departmentsList.map(dept => (
                  <option key={dept.id} value={dept.id} disabled={dept.name === reassignDoc.department}>
                    {dept.name} {dept.name === reassignDoc.department ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReassignDoc(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReassign}
                disabled={!reassignTargetId}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors shadow-sm ${!reassignTargetId ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-200 animate-scale-in">
            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              Security Verification
            </h3>
            <p className="text-slate-600 mb-6">
              As a privileged user ({user?.role}), we've sent an OTP to <strong>{user?.email}</strong>. Please enter it below to confirm this upload.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">One-Time Password</label>
              <input
                type="text"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 font-mono text-center tracking-[0.5em] text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                maxLength={6}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowOtpModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => performUpload(uploadFileRef.current!, uploadDeptId, otpValue)}
                disabled={!otpValue || otpValue.length < 6 || isUploading}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                Verify & Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};


export default App;