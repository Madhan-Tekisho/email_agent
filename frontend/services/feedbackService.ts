import { api } from './api';

// Since the `api` service is a bit monolithic in this project, we can piggyback or create a standalone one.
// Creating a standalone specific to feedback for cleanliness.

const API_BASE = 'http://localhost:3000/api'; // Or from config

export const feedbackService = {
    // Public Submit
    submitFeedback: async (token: string, rating: number, comment?: string) => {
        const response = await fetch(`${API_BASE}/feedback/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, rating, comment })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to submit feedback');
        return data;
    },

    // Admin Stats (Requires Auth Token - we can assume the user has one if they are in dashboard)
    getStats: async () => {
        // We reuse the existing authenticated fetch logic or just manual fetch with localStorage
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/feedback/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch stats');
        return data;
    }
};
