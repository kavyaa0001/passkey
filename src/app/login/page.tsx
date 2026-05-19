"use client";

import { useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { AlertCircle, Mail, Lock, ArrowRight } from "lucide-react";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"google" | "email">("google");
  const router = useRouter();

  const routeByRole = (userEmail: string) => {
    if (userEmail === ADMIN_EMAIL) {
      router.push("/admin");
    } else {
      router.push("/home");
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      routeByRole(result.user.email || "");
    } catch (err: any) {
      console.error(err);
      setError("Google sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      let result;
      try {
        result = await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        // If it matches your admin email & password, automatically register you on the fly
        if (email === "kavyatesting01@gmail.com" && password === "123456") {
          const { createUserWithEmailAndPassword } = await import("firebase/auth");
          result = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw err;
        }
      }
      routeByRole(result.user.email || "");
    } catch (err: any) {
      console.error(err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col items-center justify-center bg-[#111115] text-white px-5 overflow-hidden font-sans">
      
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#8D55F3]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-[#6552D0]/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo & Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-[#8D55F3] to-[#6552D0] rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-[0_10px_30px_rgba(141,85,243,0.4)]">
            <span className="text-3xl font-black text-white tracking-tighter">PK</span>
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Pass Key</h1>
          <p className="text-white/50 text-sm">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-[#1C1C22]/80 backdrop-blur-2xl rounded-[2rem] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/5">
          
          {error && (
            <div className="bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-xl p-4 mb-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#FF4444] shrink-0 mt-0.5" />
              <p className="text-sm text-[#FF4444]/90">{error}</p>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white text-[#111115] font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white/90 transition-colors shadow-lg mb-5 disabled:opacity-60"
          >
            {isLoading && mode === "google" ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-white/30 text-xs font-medium">or sign in with email</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-[#2A2A35] rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 border border-white/5 focus:outline-none focus:border-[#8D55F3]/50 transition-colors text-sm"
              />
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#2A2A35] rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 border border-white/5 focus:outline-none focus:border-[#8D55F3]/50 transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              onClick={() => setMode("email")}
              className="w-full bg-[#8D55F3] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#A57CF4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && mode === "email" ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Admin access is automatically detected by your email.
        </p>
      </div>
    </div>
  );
}
