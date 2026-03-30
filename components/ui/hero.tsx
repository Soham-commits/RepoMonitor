"use client"
import { Suspense, lazy } from "react"
import { motion } from "framer-motion"
import Link from "next/link";

// --- Lazy Load Sections below hero ---
const FeaturesSection = lazy(() => import("@/components/ui/features-section"));
const HowItWorksSection = lazy(() => import("@/components/ui/how-it-works-section"));
const APISection = lazy(() => import("@/components/ui/api-section"));

export default function ShaderShowcase() {
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
      <header className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-[85%] max-w-5xl">
        <nav className="flex items-center justify-between px-8 py-3 rounded-full bg-white/8 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300">
          {/* Logo */}
          <Link href="/" className="flex items-center group cursor-pointer">
            <span className="text-white/90 font-instrument serif text-3xl">Ignisia</span>
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
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-4 py-1.5 rounded-full bg-transparent border border-white/20 text-white/90 hover:text-white hover:border-white/35 text-sm font-medium transition-all whitespace-nowrap">
              Admin
            </Link>
            <Link href="/signup" className="px-4 py-1.5 rounded-full bg-transparent border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-all whitespace-nowrap">
              Start Monitoring
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Wrapper */}
      <div className="relative z-10 w-full h-screen">
        {/* Previous header was here, now replaced by fixed navbar above */}

      <main className="absolute bottom-8 left-8 z-20 max-w-2xl">
        <div className="text-left">
          <motion.div
            className="inline-flex items-center px-4 py-2 rounded-full bg-white/8 backdrop-blur-md mb-6 relative border border-white/15"
            style={{
              filter: "url(#glass-effect)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="absolute top-0 left-1 right-1 h-px bg-gradient-to-r from-transparent via-[#1E2CFF]/30 to-transparent rounded-full" />
            <span className="text-white/90 text-sm font-medium relative z-10 tracking-wide">
              Ignisia 2026 — MIT World Peace University
            </span>
          </motion.div>

          <motion.h1
            className="text-6xl md:text-7xl lg:text-8xl text-white mb-6 leading-[0.92] tracking-[-0.02em]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <span className="inline-flex items-baseline gap-3 md:gap-4">
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
            <span className="block font-instrument font-bold text-white/80">Live</span>
          </motion.h1>

          <motion.p
            className="text-lg font-playfair font-light text-white/70 mb-8 leading-relaxed max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            Real-time GitHub repo intelligence for Ignisia 2026. Track every commit, flag inactive teams, and verify submissions — all powered by the GitHub REST API.
          </motion.p>

          <motion.div
            className="flex items-center gap-6 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            <Link href="/signup">
              <motion.button
                className="px-10 py-4 rounded-full bg-transparent border-2 border-white/30 text-white font-medium text-sm transition-all duration-300 hover:bg-white/8 hover:border-white/40 hover:text-white cursor-pointer backdrop-blur-md uppercase tracking-wider font-bold"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Monitoring
              </motion.button>
            </Link>
            <Link href="/admin">
              <motion.button
                className="px-10 py-4 rounded-full bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] text-white font-semibold text-sm transition-all duration-300 hover:from-[#6A3DFF] hover:to-[#B06CFF] cursor-pointer shadow-lg hover:shadow-xl"
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
