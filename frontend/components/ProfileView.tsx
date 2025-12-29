import React, { useState, useEffect } from 'react';
import { Settings, Shield, Key, User as UserIcon, Building2, Briefcase, Zap, CheckCircle2, Inbox, Trophy } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

interface ProfileViewProps {
    user: User;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user }) => {
    // Stats State
    const [stats, setStats] = useState<any>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    // Gmail Config State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.getUserStats(user.email, user.departmentId)
            .then(data => setStats(data))
            .catch(err => console.error("Failed to load user stats", err))
            .finally(() => setLoadingStats(false));
    }, [user.email, user.departmentId]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return alert('Enter email and password');

        setLoading(true);
        try {
            const res = await fetch('/api/system/config/gmail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                alert('Gmail Config Updated Successfully!');
                // Optional: clear fields
                setEmail('');
                setPassword('');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e: any) {
            alert('Failed to update config: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">My Profile</h1>
                <p className="text-slate-500">Manage your account settings and preferences.</p>
            </div>

            {/* User Details Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white shadow-inner">
                        {user.name ? user.name.substring(0, 1).toUpperCase() : user.email.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{user.name || 'User'}</h2>
                        <p className="text-slate-500">{user.email}</p>
                        <div className="flex gap-2 mt-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wide">
                                <Briefcase className="w-3 h-3" /> {user.role}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wide">
                                <Building2 className="w-3 h-3" /> {user.companyName}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Resolved by Me</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-900">
                            {loadingStats ? '...' : stats?.resolved || 0}
                        </div>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Zap className="w-5 h-5" /></div>
                            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Avg. Speed</span>
                        </div>
                        <div className="text-2xl font-bold text-indigo-900">
                            {loadingStats ? '...' : <>{stats?.avg_speed_hours || 0}<span className="text-sm font-medium opacity-60 ml-1">hrs</span></>}
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Inbox className="w-5 h-5" /></div>
                            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Queue Load</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-900">
                            {loadingStats ? '...' : stats?.pending || 0}
                        </div>
                    </div>
                </div>

                {/* Badges */}
                {!loadingStats && stats?.badges && stats.badges.length > 0 && (
                    <div className="mb-8 pt-6 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Trophy className="w-4 h-4" /> Achievements
                        </h4>
                        <div className="flex flex-wrap gap-3">
                            {stats.badges.map((badge: string) => (
                                <div key={badge} className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-50 to-amber-50 border border-amber-100 rounded-full shadow-sm">
                                    <span className="text-lg">🏅</span>
                                    <span className="text-xs font-bold text-amber-900">{badge}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">User ID</label>
                        <p className="text-sm font-mono text-slate-700">{user.id}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Company ID</label>
                        <p className="text-sm font-mono text-slate-700">{user.companyId}</p>
                    </div>
                </div>
            </div>

            {/* Gmail Configuration - SuperAdmin Only */}
            {user.role === 'SuperAdmin' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <Settings className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Gmail Configuration</h3>
                            <p className="text-xs text-slate-500">Configure the central email gateway for the agent.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mb-6 p-4 bg-amber-50 border border-amber-100 rounded-lg">
                        <div className="p-2 bg-amber-100 rounded-full text-amber-600"><Shield className="w-5 h-5" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-amber-900 mb-1">Security Requirement</h4>
                            <p className="text-xs text-amber-700">
                                You must use an <strong>App Password</strong> from Google Security settings. Do not use your regular login password.
                                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline ml-1 font-bold hover:text-amber-900">Get one here</a>.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleUpdate} className="grid grid-cols-1 gap-6 max-w-lg">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Gmail Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="bot@company.com"
                                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">App Password</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="xxxx xxxx xxxx xxxx"
                                    className="w-full pl-10 bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono tracking-wide"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'Updating Credentials...' : 'Save Configuration'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ProfileView;
