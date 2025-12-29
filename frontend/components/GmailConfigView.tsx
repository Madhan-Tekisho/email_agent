import React, { useState } from 'react';
import { Settings, Shield, Key } from 'lucide-react';

const GmailConfigView: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

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
        <div className="p-8 max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Connect Gmail</h1>
                <p className="text-slate-500">Configure your email gateway. This account will be used to send and receive agency emails.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                <div className="flex items-center gap-4 mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-full text-blue-600"><Shield className="w-5 h-5" /></div>
                    <div>
                        <h4 className="text-sm font-bold text-blue-900 mb-1">Security Requirement</h4>
                        <p className="text-xs text-blue-700">
                            You must use an <strong>App Password</strong> from Google Security settings. Do not use your regular login password.
                            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline ml-1 font-bold hover:text-blue-900">Get one here</a>.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Gmail Address</label>
                        <div className="relative">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="bot@company.com"
                                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
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

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Updating...' : 'Save Configuration'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GmailConfigView;
