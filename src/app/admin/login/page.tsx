"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase is not connected. Check .env.local");
      return;
    }
    
    setIsLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch (err: any) {
      console.error(err);
      setError("Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col items-center justify-center bg-[#111115] text-white px-5 overflow-hidden font-sans">
      <div className="absolute inset-0 bg-gradient-to-br from-[#8D55F3]/20 to-transparent opacity-50"></div>
      
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#1C1C22] rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/5">
            <Lock className="w-8 h-8 text-[#8D55F3]" />
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Admin Portal</h1>
          <p className="text-white/50 text-sm">Sign in to access the scanner</p>
        </div>

        <div className="bg-[#1C1C22]/80 backdrop-blur-2xl rounded-[2rem] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-white/5">
          {error && (
            <div className="bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#FF4444] shrink-0 mt-0.5" />
              <p className="text-sm text-[#FF4444]/90">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-2 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@passkey.com"
                  className="w-full bg-[#2A2A35] rounded-xl pl-12 pr-4 py-4 text-white placeholder-white/30 border border-white/5 focus:outline-none focus:border-[#8D55F3]/50 transition-colors shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-2 ml-1">Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#2A2A35] rounded-xl pl-12 pr-4 py-4 text-white placeholder-white/30 border border-white/5 focus:outline-none focus:border-[#8D55F3]/50 transition-colors shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#8D55F3] text-white font-bold py-4 rounded-xl mt-4 hover:bg-[#A57CF4] transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
