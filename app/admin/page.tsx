"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { VideoBackground } from "@/components/ui/video-background";

type LoginRole = "admin" | "tech" | "both";

interface LoginResponse {
  success?: boolean;
  role?: LoginRole;
  error?: string;
}

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      let data: LoginResponse = {};

      try {
        data = (await response.json()) as LoginResponse;
      } catch {
        data = {};
      }

      if (response.ok && data.success) {
        if (data.role === "admin" || data.role === "both") {
          router.push("/admin/dashboard");
          return;
        }

        if (data.role === "tech") {
          await fetch("/api/auth/logout", { method: "POST" });
          setError("Invalid credentials");
          return;
        }
      }

      setError(data.error || "Invalid credentials");
    } catch {
      setError("Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#02020A]">
      <VideoBackground />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center py-12 px-6 selection:bg-[#1E2CFF]/30 font-sans">
        <Link href="/" className="absolute top-8 left-8 z-20">
          <button className="px-6 py-2 rounded-full bg-white/8 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 backdrop-blur-xl group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to Home
          </button>
        </Link>

        <div className="z-10 text-center mb-10 flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
            Admin Sign In
          </h1>
          <p className="text-white/70 font-light text-sm">Access the Ignisia Admin Dashboard</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 w-full max-w-md bg-white/5 border border-white/15 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#1E2CFF]/50 to-transparent" />

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-mono">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 ml-1">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  required
                  placeholder="ignisia-admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/8 border border-white/15 focus:border-white/30 rounded-2xl pl-12 pr-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 ml-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/8 border border-white/15 focus:border-white/30 rounded-2xl pl-12 pr-16 py-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-[#B06CFF] hover:text-[#B06CFF] transition-colors"
                >
                  {showPassword ? (
                    <span className="inline-flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" />Hide</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" />Show</span>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] text-white font-bold text-sm transition-all duration-300 hover:from-[#6A3DFF] hover:to-[#B06CFF] disabled:opacity-50 cursor-pointer shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/15 text-center">
            <p className="text-white/45 text-xs">Use your assigned credentials to access the admin dashboard.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
