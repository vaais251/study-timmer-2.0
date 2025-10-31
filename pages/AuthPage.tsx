import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setNotification(null);
        
        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setNotification("Sign-up successful! Please check your email inbox (and spam folder) for a confirmation link.");
                setEmail('');
                setPassword('');
            }
        } catch (err: any) {
            if (err.message && err.message.toLowerCase().includes('email not confirmed')) {
                 setError('Your email is not confirmed. Please check your inbox for the confirmation link.');
            } else {
                setError(err.error_description || err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        setNotification(null);
    
        // This implementation explicitly constructs the redirect URL from the application's
        // origin and pathname. This is the most robust client-side method to ensure
        // Supabase redirects back to the correct page after authentication, avoiding
        // issues with URL fragments or query parameters.
        //
        // IF ISSUES PERSIST: The problem is almost certainly with the Supabase project
        // configuration. Please ensure this app's URL is correctly listed in your
        // Supabase Dashboard under Authentication -> URL Configuration -> Redirect URLs.
        const redirectURL = window.location.origin + window.location.pathname;
    
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectURL,
            }
        });
    
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200" style={{fontFamily: `'Inter', sans-serif`}}>
            <div className="w-full max-w-md mx-auto px-4">
                <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-slate-700/80 animate-slideUp">
                    <h1 className="text-white text-3xl font-bold text-center mb-2 tracking-tight">FocusFlow</h1>
                    <p className="text-slate-400 text-center mb-6">{isLogin ? 'Sign in to continue' : 'Create an account to start'}</p>

                    {error && <p className="bg-red-500/30 text-red-200 p-3 rounded-lg mb-4 text-center text-sm">{error}</p>}
                    {notification && <p className="bg-green-500/30 text-green-200 p-3 rounded-lg mb-4 text-center text-sm">{notification}</p>}
                    
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full p-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                        </button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-slate-600" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-slate-800 px-2 text-sm text-slate-400">OR</span>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="w-full max-w-[300px] flex items-center justify-center gap-3 bg-transparent hover:bg-slate-700/50 border border-slate-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <title>Google icon</title>
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Continue with Google
                        </button>
                    </div>

                    <p className="text-center text-slate-400 mt-6">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={() => { setIsLogin(!isLogin); setError(null); setNotification(null); }} className="font-bold text-teal-400 hover:underline ml-2">
                            {isLogin ? 'Sign Up' : 'Login'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
