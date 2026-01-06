import React, { useEffect, useState } from 'react';
import { Star, MessageSquare, TrendingUp, AlertTriangle, RotateCcw } from 'lucide-react';
import { feedbackService } from '../services/feedbackService';
import { api } from '../services/api';

const FeedbackDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const data = await feedbackService.getStats();
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading feedback stats...</div>;

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">User Feedback</h2>
                <p className="text-slate-500">Monitor user satisfaction and response quality.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-lg">
                        <Star className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900">{stats?.average_rating || 0}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Rating</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-lg">
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900">{stats?.total_reviews || 0}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Reviews</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-lg">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        {/* Mock Trend for now */}
                        <div className="text-3xl font-bold text-slate-900">+12%</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Satisfaction Trend</div>
                    </div>
                </div>
            </div>

            {/* Recent Feedback List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Recent Ratings</h3>
                </div>

                {(!stats?.rows || stats.rows.length === 0) ? (
                    <div className="p-8 text-center text-slate-500 italic">No feedback received yet.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {stats.rows.map((row: any, i: number) => (
                            <div key={i} className="p-6 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-1">
                                        {[...Array(5)].map((_, idx) => (
                                            <Star key={idx} className={`w-4 h-4 ${idx < row.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                                        ))}
                                    </div>
                                    <span className="text-xs text-slate-400 font-medium">{new Date(row.created_at).toLocaleDateString()}</span>
                                </div>
                                {row.comment ? (
                                    <p className="text-slate-700 text-sm mt-2 italic">"{row.comment}"</p>
                                ) : (
                                    <p className="text-slate-400 text-xs mt-2 italic">No comment provided.</p>
                                )}

                                {row.emails && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1 relative">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-xs text-slate-500 font-medium">Ref: <span className="text-slate-700">{row.emails.subject}</span></div>
                                                <div className="text-[10px] text-slate-400">From: {row.emails.from_email}</div>
                                            </div>
                                            <button
                                                title="Revert Email to Needs Review"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm("Revert this email to 'Needs Review' status?")) return;
                                                    try {
                                                        await api.revertEmailStatus(row.email_id);
                                                        // Refresh stats
                                                        loadStats();
                                                        alert("Email status reverted successfully.");
                                                    } catch (err: any) {
                                                        alert(err.message || "Failed to revert status");
                                                    }
                                                }}
                                                className="ml-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors shadow-sm"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FeedbackDashboard;
