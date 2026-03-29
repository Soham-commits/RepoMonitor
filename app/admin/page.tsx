"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MeshGradient } from "@paper-design/shaders-react";
import { ArrowLeft, Flame } from "lucide-react";

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
    <div className="min-h-screen relative overflow-x-hidden bg-black flex flex-col items-center justify-center py-12 px-6 selection:bg-cyan-500/30 font-sans">
      <Link href="/" className="absolute top-8 left-8 z-20">
        <button className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 backdrop-blur-sm group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </button>
      </Link>

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

      <div className="z-10 w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <Flame className="w-10 h-10 text-cyan-400 mb-3" />
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-white/60 text-sm mt-2">Ignisia 2026 — Restricted Access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ignisia-admin"
              className="w-full bg-black/40 border-2 border-white/10 focus:border-cyan-400/50 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 focus:border-cyan-400/50 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-white/80">GitHub PAT <span className="text-white/50">(Optional)</span></label>
              {hasStoredPat && !editingPat && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(ADMIN_PAT_KEY);
                    setHasStoredPat(false);
                    setEditingPat(true);
                    setPat("");
                  }}
                  className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
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
                className="w-full bg-black/40 border-2 border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/30 focus:outline-none text-sm shadow-inner disabled:opacity-80"
              />
            ) : (
              <input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_••••••••••••"
                className="w-full bg-black/40 border-2 border-white/10 focus:border-cyan-400/50 rounded-2xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:ring-0 transition-all text-sm shadow-inner"
              />
            )}

            <p className="text-white/45 text-xs mt-2">Stored locally in your browser only. Never sent to any server.</p>
          </div>

          <button
            type="submit"
            className="w-full px-10 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-orange-500 text-white font-semibold text-sm transition-all duration-300 hover:from-cyan-400 hover:to-orange-400 cursor-pointer shadow-lg hover:shadow-xl"
          >
            Sign In
          </button>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>
      </div>
    </div>
  );
}