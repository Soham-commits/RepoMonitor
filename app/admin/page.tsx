"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VideoBackground } from "@/components/ui/video-background";

const ADMIN_USERNAME = "ignisia-admin";
const ADMIN_PASSWORD = "ignisia@2026";
const ADMIN_PAT_KEY = "admin-pat";

export default function AdminPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pat, setPat] = useState("");
  const [hasStoredPat, setHasStoredPat] = useState(false);
  const [editingPat, setEditingPat] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    const savedPat = localStorage.getItem(ADMIN_PAT_KEY)?.trim() || "";
    if (savedPat) {
      setPat(savedPat);
      setHasStoredPat(true);
      setEditingPat(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      if (pat.trim()) {
        localStorage.setItem(ADMIN_PAT_KEY, pat.trim());
      }
      localStorage.setItem("admin-auth", "true");
      router.push("/admin/dashboard");
      return;
    }

    setError("Invalid credentials");
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

      <div className="z-10 w-full max-w-md bg-white/5 backdrop-blur-md border border-white/15 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-white/70 text-sm mt-2">Ignisia 2026 — Restricted Access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ignisia-admin"
              className="w-full bg-white/8 border border-white/15 focus:border-white/30 rounded-2xl px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/8 border border-white/15 focus:border-white/30 rounded-2xl px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-white/80">GitHub PAT <span className="text-white/45">(Optional)</span></label>
              {hasStoredPat && !editingPat && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(ADMIN_PAT_KEY);
                    setHasStoredPat(false);
                    setEditingPat(true);
                    setPat("");
                  }}
                  className="text-xs text-[#B06CFF] hover:text-[#B06CFF] transition-colors"
                >
                  Change
                </button>
              )}
            </div>

            {hasStoredPat && !editingPat ? (
              <input
                type="password"
                value=""
                disabled
                placeholder="ghp_••••••••••••"
                className="w-full bg-white/8 border border-white/15 rounded-2xl px-5 py-4 text-white placeholder:text-white/40 focus:outline-none text-sm shadow-inner disabled:opacity-80"
              />
            ) : (
              <input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_••••••••••••"
                className="w-full bg-white/8 border border-white/15 focus:border-white/30 rounded-2xl px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
              />
            )}

            <p className="text-white/45 text-xs mt-2">Stored locally in your browser only. Never sent to any server.</p>
          </div>

          <button
            type="submit"
            className="w-full px-10 py-4 rounded-full bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] text-white font-semibold text-sm transition-all duration-300 hover:from-[#6A3DFF] hover:to-[#B06CFF] cursor-pointer shadow-lg hover:shadow-xl"
          >
            Sign In
          </button>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>
      </div>
      </div>
    </div>
  );
}