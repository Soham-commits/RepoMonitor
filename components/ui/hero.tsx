"use client"
import { Suspense, lazy, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
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
      <header className="fixed top-4 md:top-8 left-1/2 -translate-x-1/2 z-50 w-[92%] md:w-[85%] max-w-5xl">
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

          {/* Buttons - Right Side */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/admin" className="px-4 py-2 rounded-full bg-transparent border border-white/20 text-white/90 hover:text-white hover:border-white/35 hover:scale-105 text-sm font-medium transition-all duration-300 ease-in-out whitespace-nowrap">
              Admin
            </Link>
            <Link href="/signup" className="px-4 py-2 rounded-full bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] text-white font-semibold text-sm shadow-lg hover:scale-105 transition-all duration-300 ease-in-out whitespace-nowrap">
              Start Monitoring
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden h-10 w-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-xl text-white flex items-center justify-center shadow-lg"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:hidden fixed inset-0 z-[60]"
          >
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute right-3 top-3 bottom-3 w-[82%] max-w-sm rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg p-5"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-white">Navigation</h2>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3 text-sm">
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 bg-white/10 border border-white/20 text-white/90"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 bg-white/10 border border-white/20 text-white/90"
                >
                  How It Works
                </a>
                <a
                  href="#api"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 bg-white/10 border border-white/20 text-white/90"
                >
                  Event Stats
                </a>
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 border border-white/20 text-white text-center font-medium bg-white/10"
                >
                  Admin
                </Link>
                <Link
                  href="/setup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 border border-white/20 text-white text-center font-medium bg-white/10"
                >
                  Dashboard
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-white text-center font-semibold bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] shadow-lg"
                >
                  Start Monitoring
                </Link>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Wrapper */}
      <div className="relative z-10 w-full min-h-screen overflow-x-hidden">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-none" />
        {/* Previous header was here, now replaced by fixed navbar above */}

      <main className="relative z-20 w-full min-h-screen flex items-end justify-start px-4 sm:px-8 lg:px-16 pb-24 md:pb-32 pt-32">
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
                className="font-extrabold text-white"
                style={{ fontFamily: "Satoshi, var(--font-geist-sans), sans-serif" }}
              >
                Teams
              </span>
            </span>
            <span className="block font-instrument font-bold text-white/80 mt-1 md:mt-2">Live</span>
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg md:text-xl font-playfair font-light text-white/75 leading-relaxed max-w-xl mx-auto md:mx-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            Real-time GitHub repo intelligence for Ignisia 2026. Track every commit, flag inactive teams, and verify submissions — all powered by the GitHub REST API.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 md:gap-4 pt-4 w-full sm:w-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            <Link href="/signup" className="w-full sm:w-auto">
              <motion.button
                className="w-full px-10 py-4 rounded-full bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] text-white font-semibold text-sm md:text-base transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-[0_0_24px_rgba(30,44,255,0.45)] cursor-pointer uppercase tracking-wider"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Monitoring
              </motion.button>
            </Link>
            <Link href="/admin" className="w-full sm:w-auto">
              <motion.button
                className="w-full px-10 py-4 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white font-medium text-sm md:text-base transition-all duration-300 ease-in-out hover:scale-105 hover:bg-white/15 cursor-pointer"
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
