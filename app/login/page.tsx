"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MeshGradient } from "@paper-design/shaders-react";
import { Flame, ArrowLeft, Loader2, User, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const ADMIN_USERNAME = "ignisia-admin";
const ADMIN_PASSWORD = "ignisia@2026";

export default function LoginPage() {
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
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        router.push("/setup");
      } else {
        throw new Error("Invalid username or password");
      }
    } catch (err: any) {
      setError(err.message || "Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-black flex flex-col items-center justify-center py-12 px-6 selection:bg-cyan-500/30 font-sans">
      {/* Back Button */}
      <Link href="/" className="absolute top-8 left-8 z-20">
        <button className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 backdrop-blur-sm group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </button>
      </Link>

      {/* Background Gradient Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <MeshGradient
          className="absolute inset-0 w-full h-full"
          colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
          speed={0.3}
        />
        <MeshGradient
          className="absolute inset-0 w-full h-full opacity-60"
          colors={["#000000", "#ffffff", "#06b6d4", "#f97316"]}
          speed={0.2}
        />
      </div>

      {/* Header */}
      <div className="z-10 text-center mb-10 flex flex-col items-center">
        <div className="flex items-center group cursor-pointer mb-4">
          <Flame className="w-12 h-12 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
          Sign In
        </h1>
        <p className="text-white/60 font-light text-sm">Welcome back to RepoMonitor Intelligence</p>
      </div>

      {/* Login Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

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
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/10 focus:border-cyan-400/50 rounded-2xl pl-12 pr-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
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
                className="w-full bg-black/40 border-2 border-white/10 focus:border-cyan-400/50 rounded-2xl pl-12 pr-16 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors"
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
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-orange-500 text-white font-bold text-sm transition-all duration-300 hover:from-cyan-400 hover:to-orange-400 disabled:opacity-50 cursor-pointer shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
