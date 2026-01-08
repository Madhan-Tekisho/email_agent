import React, { useState } from 'react';
import { Mail, CheckCircle } from 'lucide-react';

const ConnectEmailButton: React.FC = () => {
    const [loading, setLoading] = useState(false);

    const handleConnect = async () => {
        setLoading(true);
        try {
            // Updated to port 4000 (Backend) directly
            const res = await fetch('http://localhost:4000/auth/google/url');
            const data = await res.json();
            if (data.url) {
                // Redirect user to Google
                window.location.href = data.url;
            } else {
                alert('Failed to get Auth URL');
            }
        } catch (error) {
            console.error(error);
            alert('Error connecting to backend');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-8 pt-8 border-t border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">
                Connect via OAuth (Recommended)
            </h4>
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                <p className="text-sm text-blue-800 mb-4">
                    Connect your Gmail account directly to allow the agent to read and reply to emails automatically.
                    This is more secure than using App Passwords.
                </p>

                <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="flex items-center gap-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold py-3 px-6 rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    {loading ? 'Connecting...' : 'Connect Gmail Account'}
                </button>
            </div>
        </div>
    );
};

export default ConnectEmailButton;
