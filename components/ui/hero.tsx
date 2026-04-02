"use client"
import { Suspense, lazy, useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link";
import { Menu, X } from "lucide-react";

// --- Lazy Load Sections below hero ---
const FeaturesSection = lazy(() => import("@/components/ui/features-section"));
const HowItWorksSection = lazy(() => import("@/components/ui/how-it-works-section"));
const APISection = lazy(() => import("@/components/ui/api-section"));

export default function ShaderShowcase() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileMenuOpen)
    return () => document.body.classList.remove("menu-open")
  }, [mobileMenuOpen])

  return (
    <div className="relative overflow-x-hidden selection:bg-[#1E2CFF]/30">
      <svg className="absolute inset-0 w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
          <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E2CFF" />
            <stop offset="50%" stopColor="#B06CFF" />
            <stop offset="100%" stopColor="#1E2CFF" />
          </linearGradient>
          <linearGradient id="hero-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B06CFF" />
            <stop offset="30%" stopColor="#1E2CFF" />
            <stop offset="70%" stopColor="#6A3DFF" />
            <stop offset="100%" stopColor="#B06CFF" />
          </linearGradient>
          <filter id="text-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Glass Transparent Pill Navbar */}
      <header className="fixed top-4 md:top-8 left-1/2 -translate-x-1/2 z-[70] w-[92%] md:w-[85%] max-w-5xl">
        <nav className="flex items-center justify-between px-4 md:px-8 py-3 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg transition-all duration-300 ease-in-out">
          {/* Logo */}
          <Link href="/" className="flex items-center group cursor-pointer">
            <span className="text-white/90 font-instrument serif text-2xl md:text-3xl">Ignisia</span>
          </Link>

          {/* Nav Links - Centered */}
          <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
            <a
              href="#features"
              className="text-white/70 hover:text-white transition-colors duration-200 text-sm font-normal"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-white/70 hover:text-white transition-colors duration-200 text-sm font-normal"
            >
              How It Works
            </a>
            <a
              href="#api"
              className="text-white/70 hover:text-white transition-colors duration-200 text-sm font-normal"
            >
              Event Stats
            </a>
          </div>

          {/* Buttons - Right Side (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 rounded-full bg-transparent border border-white/20 text-white/90 hover:text-white hover:border-white/35 hover:scale-105 text-sm font-medium transition-all duration-300 ease-in-out whitespace-nowrap">
              Admin
            </Link>
            <Link href="/login" className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/25 text-white font-semibold text-sm shadow-[0_10px_24px_rgba(8,12,30,0.35)] hover:bg-white/12 hover:border-white/40 hover:scale-105 transition-all duration-300 ease-in-out whitespace-nowrap">
              Start Monitoring
            </Link>
          </div>

          {/* Mobile Right Side Controls (Menu) */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="h-8 w-8 rounded-full border border-white/20 bg-white/10 backdrop-blur-xl text-white flex items-center justify-center shadow-lg transition-all"
            >
              {mobileMenuOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* FLOATING NAVIGATION (Mobile - No Box) */}
      <div
        className={`md:hidden fixed inset-0 z-[60] flex items-center justify-center transition-all duration-500 ${
          mobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        {/* BACKGROUND BLUR */}
        <div
          onClick={() => setMobileMenuOpen(false)}
          className={`absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-500 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* CONTENT (NO BOX) */}
        <div
          className={`relative z-10 w-full max-w-sm px-6 py-10 flex flex-col items-center gap-6 text-center transform transition-all duration-500 ease-out ${
            mobileMenuOpen ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-4 opacity-0"
          }`}
        >
          {/* LINKS */}
          <div className="flex flex-col items-center gap-6 w-full text-center mt-4">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-white/70 hover:text-white text-xl transition-colors font-medium"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-white/70 hover:text-white text-xl transition-colors font-medium"
            >
              How It Works
            </a>
            <a
              href="#api"
              onClick={() => setMobileMenuOpen(false)}
              className="text-white/70 hover:text-white text-xl transition-colors font-medium"
            >
              Event Stats
            </a>
          </div>

          {/* CTA */}
          <div className="w-full flex flex-col gap-4 mt-6">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <button className="w-full px-8 py-4 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-white font-medium hover:bg-white/10 transition-colors duration-300">
                Admin
              </button>
            </Link>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <button className="w-full px-8 py-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/25 text-white font-medium hover:scale-105 hover:bg-white/12 hover:border-white/40 transition-all duration-300 shadow-[0_10px_24px_rgba(8,12,30,0.35)]">
                Start Monitoring
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Wrapper */}
      <div className="relative z-10 w-full min-h-screen overflow-x-hidden">
        <div className="absolute inset-0 bg-transparent pointer-events-none" />
        {/* Previous header was here, now replaced by fixed navbar above */}

      <main className="relative z-20 w-full min-h-screen flex items-center md:items-end justify-start px-4 sm:px-8 lg:px-16 pb-10 md:pb-12 pt-24 md:pt-32">
        <div className="w-full max-w-7xl mx-auto flex flex-col items-center md:items-start text-center md:text-left space-y-4 md:space-y-6">
          
          <motion.div
            className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 relative"
            style={{
              filter: "url(#glass-effect)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="absolute top-0 left-1 right-1 h-px bg-gradient-to-r from-transparent via-[#1E2CFF]/30 to-transparent rounded-full" />
            <span className="text-white/90 text-xs md:text-sm font-medium relative z-10 tracking-wide">
              Ignisia 2026 — MIT World Peace University
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-[4.5rem] lg:text-[6rem] text-white leading-[0.92] tracking-[-0.02em]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <span className="inline-flex flex-wrap items-baseline justify-center md:justify-start gap-2 sm:gap-3">
              <motion.span
                className="font-medium text-white/92"
                style={{ fontFamily: "Satoshi, var(--font-geist-sans), sans-serif" }}
              >
                Monitor
              </motion.span>
              <span
                className="text-white"
                style={{ fontFamily: "Satoshi, var(--font-geist-sans), sans-serif" }}
              >
                Teams
              </span>
            </span>
            <span className="block font-instrument font-bold text-white/80 mt-1 md:mt-2">Live</span>
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg md:text-xl font-black font-light text-white/75 leading-relaxed max-w-xl mx-auto md:mx-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            Real-time GitHub repo intelligence for Ignisia 2026. Track every commit, flag inactive teams, and verify submissions — all powered by the GitHub REST API.
          </motion.p>

          <motion.div
            className="flex flex-row items-center justify-center md:justify-start gap-3 sm:gap-4 pt-4 w-full sm:w-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            <Link href="/login" className="flex-1 sm:flex-none w-full sm:w-auto">
              <motion.button
                className="w-full px-4 sm:px-10 py-3.5 sm:py-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/25 text-white font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 ease-in-out hover:scale-105 hover:bg-white/12 hover:border-white/40 hover:shadow-[0_10px_24px_rgba(8,12,30,0.35)] cursor-pointer uppercase tracking-wider whitespace-nowrap"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Monitoring
              </motion.button>
            </Link>
            <Link href="/login" className="flex-1 sm:flex-none w-full sm:w-auto">
              <motion.button
                className="w-full px-4 sm:px-10 py-3.5 sm:py-4 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white font-medium text-xs sm:text-sm md:text-base transition-all duration-300 ease-in-out hover:scale-105 hover:bg-white/15 cursor-pointer whitespace-nowrap"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Admin
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </main>

      </div> {/* End Hero Wrapper */}

      {/* --- Lazy Loaded Sections --- */}
      <Suspense fallback={<div className="h-[400px]" />}>
        <FeaturesSection />
      </Suspense>

      <Suspense fallback={<div className="h-[400px]" />}>
        <HowItWorksSection />
      </Suspense>

      <Suspense fallback={<div className="h-[400px]" />}>
        <APISection />
      </Suspense>
      
    </div>
  )
}
