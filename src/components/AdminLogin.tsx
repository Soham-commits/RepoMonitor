"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, User, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { MeshGradient } from "@paper-design/shaders-react";
import { StarButton } from "./StarButton";

interface AdminLoginProps {
  onLogin: (username: string, password: string) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (username === "ignisia-admin" && password === "ignisia@2026") {
      onLogin(username, password);
    } else {
      setError("Invalid administrative credentials.");
    }
  };

  return (
    <div className="min-h-screen relative bg-black flex items-center justify-center p-6 font-sans">
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

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-md"
      >
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center backdrop-blur-md">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Admin Access</h1>
            <p className="text-white/40 text-sm font-medium uppercase tracking-widest mt-1">RepoMonitor Control Center</p>
          </div>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-16 py-4 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 transition-all"
                  required
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

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <StarButton type="submit" className="w-full mt-2">
              <div className="flex items-center gap-2">
                AUTHENTICATE
                <ArrowRight className="w-4 h-4" />
              </div>
            </StarButton>
          </form>
        </div>

        <p className="text-center mt-8 text-white/20 text-xs font-medium">
          Authorized personnel only. All access attempts are logged.
        </p>
      </motion.div>
    </div>
  );
}
