"use client"
import { motion } from "framer-motion"
import { Zap, Crosshair, TrafficCone, Flag, ShieldAlert, Download } from "lucide-react"

export default function FeaturesSection() {
  return (
    <section id="features" className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 md:py-32">
      <div className="text-center mb-12 sm:mb-16">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
          Everything You Need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E2CFF] to-[#B06CFF]">Run a Transparent Hackathon</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[
          { icon: Zap, title: "Live Commit Tracking", desc: "Every push from every team tracked automatically. Updated every 8 minutes without lifting a finger." },
          { icon: Crosshair, title: "Hackathon Window Filter", desc: "Only commits made between April 2-4, 2026 count. Pre-built code and last-minute uploads get flagged instantly." },
          { icon: TrafficCone, title: "Smart Status Logic", desc: "Active, Idle, Inactive, or Dead - every team classified by real commit activity, not assumptions." },
          { icon: Flag, title: "Automated Flag System", desc: "Zero commits, solo contributors, and private repos flagged automatically. No manual checking needed." },
          { icon: ShieldAlert, title: "Rate Limit Protection", desc: "Tiered GitHub API strategy with graceful degradation. Stays alive for the full 24 hours of Ignisia." },
          { icon: Download, title: "Judge-Ready CSV Export", desc: "Download a full team activity report for judges at any point during or after the hackathon." }
        ].map((feature, i) => (
          <motion.div
            key={i}
            className="p-6 sm:p-8 rounded-3xl bg-white/5 backdrop-blur-md border border-white/15 hover:bg-white/8 transition-all group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (i % 3) * 0.1, duration: 0.5 }}
            style={{ willChange: "transform", transform: "translateZ(0)" }}
          >
            <div className="w-12 h-12 rounded-full bg-[#1E2CFF]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <feature.icon className="w-6 h-6 text-[#1E2CFF]" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-3">{feature.title}</h3>
            <p className="text-white/70 font-light leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
