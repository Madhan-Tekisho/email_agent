import React, { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { api } from '../services/api';
import { Loader2, TrendingUp, BarChart3, PieChart as PieIcon, Activity } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AnalyticsView = () => {
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<any>(null);
    const [deptStats, setDeptStats] = useState<any[]>([]);
    const [trends, setTrends] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [ov, ds, tr] = await Promise.all([
                api.getAnalyticsOverview(),
                api.getAnalyticsDepartment(),
                api.getAnalyticsTrends()
            ]);
            setOverview(ov);
            setDeptStats(ds);
            setTrends(tr);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 h-full overflow-y-auto custom-scrollbar bg-slate-50/50">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
                    <p className="text-slate-500">Real-time insights and performance metrics</p>
                </div>
                <button onClick={fetchData} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm">
                    Refresh Data
                </button>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg"><Activity className="w-5 h-5 text-blue-600" /></div>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">+12% vs last week</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1">{overview.total}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Emails</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-amber-50 rounded-lg"><Activity className="w-5 h-5 text-amber-600" /></div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1">{overview.pending}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1">{overview.resolved}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resolved</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-purple-50 rounded-lg"><BarChart3 className="w-5 h-5 text-purple-600" /></div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1">{overview.resolutionRate}%</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resolution Rate</div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Volume Trend */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-slate-400" /> Email Volume (Last 7 Days)
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trends}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0088FE" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#0088FE" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="total" stroke="#0088FE" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" name="Total Received" />
                                <Area type="monotone" dataKey="resolved" stroke="#00C49F" strokeWidth={2} fillOpacity={0} fill="transparent" name="Resolved" />
                                <Legend />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Resolution by Dept (Pie) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <PieIcon className="w-5 h-5 text-slate-400" /> Department Load
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={deptStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="total"
                                >
                                    {deptStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-slate-400" /> Operational Efficiency by Department
                </h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deptStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="total" name="Total Emails" fill="#0088FE" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="resolved" name="Resolved" fill="#00C49F" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="pending" name="Pending" fill="#FFBB28" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsView;
