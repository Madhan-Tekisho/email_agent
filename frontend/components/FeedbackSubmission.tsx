import React, { useState } from 'react';
import { Star, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { feedbackService } from '../services/feedbackService';

interface FeedbackSubmissionProps {
    token: string;
}

const FeedbackSubmission: React.FC<FeedbackSubmissionProps> = ({ token }) => {
    const [rating, setRating] = useState<number>(0);
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            setError("Please select a rating");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await feedbackService.submitFeedback(token, rating, comment);
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || "Failed to submit feedback");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center animate-fade-in border border-slate-100">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Thank you!</h2>
                    <p className="text-slate-600">Your feedback helps us improve our service.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl p-8 animate-fade-in border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">How did we do?</h1>
                    <p className="text-slate-500 mt-2">Please rate your experience with our support resolution.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Star Rating */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                >
                                    <Star
                                        className={`w-10 h-10 transition-colors ${star <= (hoveredRating || rating)
                                                ? 'text-amber-400 fill-amber-400'
                                                : 'text-slate-200 fill-slate-50'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        <span className="text-sm font-bold text-slate-600 h-5">
                            {hoveredRating === 1 ? 'Very Poor' :
                                hoveredRating === 2 ? 'Poor' :
                                    hoveredRating === 3 ? 'Average' :
                                        hoveredRating === 4 ? 'Good' :
                                            hoveredRating === 5 ? 'Excellent' :
                                                rating > 0 ? (rating === 1 ? 'Very Poor' : rating === 2 ? 'Poor' : rating === 3 ? 'Average' : rating === 4 ? 'Good' : 'Excellent') : ''}
                        </span>
                    </div>

                    {/* Comment */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Additional Comments (Optional)</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white"
                            rows={4}
                            placeholder="Tell us more about your experience..."
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Submit Feedback <Send className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default FeedbackSubmission;
