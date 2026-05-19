"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Not logged in → go to unified login page
        router.replace("/login");
      } else if (user.email === ADMIN_EMAIL) {
        // Admin email → go to admin scanner
        router.replace("/admin");
      } else {
        // Normal user → go to user home
        router.replace("/home");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Show loading spinner while checking
  return (
    <div className="w-full h-[100dvh] flex items-center justify-center bg-[#111115]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-gradient-to-br from-[#8D55F3] to-[#6552D0] rounded-[1.25rem] flex items-center justify-center shadow-[0_10px_30px_rgba(141,85,243,0.4)]">
          <span className="text-2xl font-black text-white tracking-tighter">PK</span>
        </div>
        <div className="w-6 h-6 border-4 border-[#8D55F3]/30 border-t-[#8D55F3] rounded-full animate-spin"></div>
      </div>
    </div>
  );
}
