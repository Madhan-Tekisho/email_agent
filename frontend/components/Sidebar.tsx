import { LayoutDashboard, Mail, FileText, Settings, LogOut, ShieldCheck, BarChart3, HelpCircle, X, Link } from 'lucide-react';
import React from 'react';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  onLogout: () => void;
  user: { role: string; departmentName?: string };
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout, user }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Intelligence', icon: BarChart3 },
    { id: 'emails', label: 'Communications', icon: Mail },
    { id: 'documents', label: 'Knowledge Base', icon: FileText },
  ];

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col fixed left-0 top-0 z-30 shadow-xl text-white">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg shadow-blue-900/50">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white block leading-none">EmailQ.AI</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Enterprise</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 flex-1 space-y-8 overflow-y-auto">
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Operations</p>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${currentView === item.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                <item.icon className={`w-4 h-4 transition-colors ${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>


        <div>
          <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">System</p>
          <nav className="space-y-1">
            <button
              onClick={() => setView('feedback')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${currentView === 'feedback'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <HelpCircle className={`w-4 h-4 transition-colors ${currentView === 'feedback' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
              User Feedback
            </button>
            <button
              onClick={() => setView('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${currentView === 'profile'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Link className={`w-4 h-4 transition-colors ${currentView === 'profile' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
              My Profile
            </button>
            {user.role === 'SuperAdmin' && (
              <button
                onClick={() => setView('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${currentView === 'settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                <Settings className={`w-4 h-4 transition-colors ${currentView === 'settings' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                Configuration
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 relative">
        {/* User Profile Card */}
        <div
          className={`group flex items-center gap-3 mb-4 p-3 rounded-xl border transition-all bg-slate-800/50 border-slate-800`}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
              {user.role.substring(0, 2).toUpperCase()}
            </div>
            {user.role === 'SuperAdmin' && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              </div>
            )}
          </div>

          <div className="overflow-hidden flex-1">
            <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">
              {user.departmentName ? user.departmentName : 'Operator ID: 8492'}
            </p>
            <p className="text-[10px] text-blue-400 truncate uppercase font-bold tracking-wide">{user.role}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-950 text-slate-400 border border-slate-800 rounded-xl text-xs font-bold hover:bg-red-950/30 hover:text-red-400 hover:border-red-900/50 transition-all group"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;