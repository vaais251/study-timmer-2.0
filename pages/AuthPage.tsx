
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            let authError;
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                authError = error;
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                authError = error;
            }

            if (authError) {
                throw authError;
            }
            // The onAuthStateChange listener in App.tsx will handle the redirect.
        } catch (err: any) {
            setError(err.error_description || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2]">
            <div className="w-full max-w-md mx-auto px-4">
                <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-white/20 animate-slideIn">
                    <h1 className="text-white text-3xl font-bold text-center mb-2">AI Pomodoro Timer</h1>
                    <p className="text-white/80 text-center mb-6">{isLogin ? 'Sign in to continue' : 'Create an account to start'}</p>

                    {error && <p className="bg-red-500/50 text-white p-3 rounded-lg mb-4 text-center">{error}</p>}
                    
                    <form onSubmit={handleAuth}>
                        <div className="mb-4">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                            />
                        </div>
                        <div className="mb-6">
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full p-3 bg-gradient-to-br from-cyan-400 to-blue-600 text-white font-bold rounded-lg transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                        </button>
                    </form>

                    <p className="text-center text-white/70 mt-6">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="font-bold text-white hover:underline ml-2">
                            {isLogin ? 'Sign Up' : 'Login'}
                        </button>
                    </p>
                </div>
                 <style>{`
                  @keyframes slideIn {
                      from { opacity: 0; transform: translateY(-30px); }
                      to { opacity: 1; transform: translateY(0); }
                  }
                  .animate-slideIn { animation: slideIn 0.5s ease-out; }
                `}</style>
            </div>
        </div>
    );
};

export default AuthPage;
