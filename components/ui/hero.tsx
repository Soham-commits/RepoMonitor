"use client"
import { useEffect, useRef, useState, Suspense, lazy } from "react"
import { MeshGradient, PulsingBorder } from "@paper-design/shaders-react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUpRight, Flame, Zap, Crosshair, TrafficCone, Flag, ShieldAlert, Download, Key, Link as LinkIcon, Play, Database, Gauge } from "lucide-react"
import Link from "next/link";

// --- Lazy Load Sections below hero ---
const FeaturesSection = lazy(() => import("@/components/ui/features-section"));
const HowItWorksSection = lazy(() => import("@/components/ui/how-it-works-section"));
const APISection = lazy(() => import("@/components/ui/api-section"));

// We create a motion-wrapped Flame icon for the logo
const MotionFlame = motion.create(Flame)

export default function ShaderShowcase() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // ⚡ Optimization 4: Delay shader and heavy animations by 100ms
    // to prevent blocking first paint.
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);

    const handleMouseEnter = () => setIsActive(true)
    const handleMouseLeave = () => setIsActive(false)

    const container = containerRef.current
    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter)
      container.addEventListener("mouseleave", handleMouseLeave)
    }

    return () => {
      clearTimeout(timer);
      if (container) {
        container.removeEventListener("mouseenter", handleMouseEnter)
        container.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="bg-black relative overflow-x-hidden selection:bg-cyan-500/30">
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
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="hero-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#06b6d4" />
            <stop offset="70%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ffffff" />
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

      {/* ⚡ Optimization 1: Force GPU compositing for heavy shader background */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ willChange: "transform", transform: "translateZ(0)" }}
      >
        <AnimatePresence>
          {mounted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Glass Transparent Pill Navbar */}
      <header className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-[85%] max-w-5xl">
        <nav className="flex items-center justify-between px-8 py-3 rounded-full bg-white/5 backdrop-blur-2xl border border-white/20 shadow-2xl transition-all duration-300">
          {/* Logo */}
          <Link href="/" className="flex items-center group cursor-pointer">
            <span className="text-white/90 font-playfair font-bold text-2xl italic tracking-tight">IgnisEye</span>
          </Link>

          {/* Nav Links - Centered */}
          <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
            <a
              href="#features"
              className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-normal"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-normal"
            >
              How It Works
            </a>
            <a
              href="#api"
              className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-normal"
            >
              Event Stats
            </a>
          </div>

          {/* Buttons - Right Side */}
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-4 py-1.5 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30 text-sm transition-all whitespace-nowrap">
              Admin
            </Link>
            <Link href="/signup" className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white text-sm transition-all whitespace-nowrap">
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
            className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm mb-6 relative border border-white/10"
            style={{
              filter: "url(#glass-effect)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="absolute top-0 left-1 right-1 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent rounded-full" />
            <span className="text-white/90 text-sm font-medium relative z-10 tracking-wide">
              Ignisia 2026 — MIT World Peace University
            </span>
          </motion.div>

          <motion.h1
            className="text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-none tracking-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.span
              className="block font-light text-white/90 text-4xl md:text-5xl lg:text-6xl mb-2 tracking-wider"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #06b6d4 30%, #f97316 70%, #ffffff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "url(#text-glow)",
              }}
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            >
              Monitor
            </motion.span>
            <span className="block font-black text-white drop-shadow-2xl">Teams</span>
            <span className="block font-light text-white/80 italic">Live</span>
          </motion.h1>

          <motion.p
            className="text-lg font-light text-white/70 mb-8 leading-relaxed max-w-xl"
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
                className="px-10 py-4 rounded-full bg-transparent border-2 border-white/30 text-white font-medium text-sm transition-all duration-300 hover:bg-white/10 hover:border-cyan-400/50 hover:text-cyan-100 cursor-pointer backdrop-blur-sm uppercase tracking-wider font-bold"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Monitoring
              </motion.button>
            </Link>
            <Link href="/admin">
              <motion.button
                className="px-10 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-orange-500 text-white font-semibold text-sm transition-all duration-300 hover:from-cyan-400 hover:to-orange-400 cursor-pointer shadow-lg hover:shadow-xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Admin
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </main>

      <div className="absolute bottom-8 right-8 z-30">
        <div className="relative w-20 h-20 flex items-center justify-center">
          {mounted && (
            <PulsingBorder
              colors={["#06b6d4", "#0891b2", "#f97316", "#00FF88", "#FFD700", "#FF6B35", "#ffffff"]}
              colorBack="#00000000"
              speed={1.5}
              roundness={1}
              thickness={0.1}
              softness={0.2}
              intensity={5}
              spotSize={0.1}
              pulse={0.1}
              smoke={0.5}
              smokeSize={4}
              scale={0.65}
              rotation={0}
              frame={9161408.251009725}
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                willChange: "transform",
                transform: "translateZ(0)"
              }}
            />
          )}

          {/* Rotating Text Around the Pulsing Border */}
          <motion.svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            animate={{ rotate: 360 }}
            transition={{
              duration: 20,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            style={{ transform: "scale(1.6)", willChange: "transform" }}
          >
            <defs>
              <path id="circle" d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
            </defs>
            <text className="text-sm fill-white/80 font-medium">
              <textPath href="#circle" startOffset="0%">
                Ignisia Repo Monitor • Live Intelligence • Real-time Tracking •
              </textPath>
            </text>
          </motion.svg>
        </div>
      </div>
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
