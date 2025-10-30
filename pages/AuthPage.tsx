import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

// --- ACTION REQUIRED (Step 2) ---
// Paste your Google Client ID here. You can find this in your Google Cloud Console
// under APIs & Services > Credentials. It is the same Client ID you configured in Supabase.
// FIX: Explicitly type GOOGLE_CLIENT_ID as string to avoid a TypeScript error on comparison.
const GOOGLE_CLIENT_ID: string = "341516745442-3qtu2ba6oeetfo4p4babipstta523h0i.apps.googleusercontent.com";

declare global {
    interface Window {
        google: any;
    }
}

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    // This effect handles the new Google Sign-In button
    useEffect(() => {
        if (GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") {
             const buttonDiv = document.getElementById("googleSignInButton");
             if (buttonDiv) {
                buttonDiv.innerHTML = '<p class="text-red-400 text-xs text-center p-2">Google Sign-In is not configured.<br/>Please add your Client ID to AuthPage.tsx.</p>';
             }
             return;
        }

        const handleCredentialResponse = async (response: any) => {
            setLoading(true);
            setError(null);
            
            // We get the ID token from Google's response
            const { credential } = response;
            
            // Then, we use it to sign in to Supabase without any redirects
            const { error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: credential,
            });

            if (error) {
                setError(error.message);
            }
            // On success, onAuthStateChange in App.tsx will handle the session update
            setLoading(false);
        };

        const initializeGSI = () => {
            if (!window.google || !window.google.accounts) {
                console.error("Google script not loaded");
                return;
            }
             try {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse,
                });

                window.google.accounts.id.renderButton(
                    document.getElementById("googleSignInButton"),
                    // You can customize the button appearance here
                    { theme: "outline", size: "large", type: "standard", text: "continue_with", width: "300" } 
                );
            } catch (e) {
                console.error("Error initializing Google Sign In", e);
                setError("Could not initialize Google Sign-In.");
            }
        }
        
        // Dynamically load the Google script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initializeGSI;
        document.body.appendChild(script);

        return () => {
            // Cleanup the script when the component unmounts
            document.body.removeChild(script);
        };
    }, []);

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
                        <div id="googleSignInButton"></div>
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