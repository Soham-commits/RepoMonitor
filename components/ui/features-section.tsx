"use client"
import { motion } from "framer-motion"
import { Zap, Crosshair, TrafficCone, Flag, ShieldAlert, Download } from "lucide-react"

export default function FeaturesSection() {
  return (
    <section id="features" className="relative z-20 max-w-7xl mx-auto px-6 py-32">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Everything You Need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-orange-400">Monitor 100 Teams</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { icon: Zap, title: "Live Commit Tracking", desc: "See every push as it happens, updated every 8 minutes automatically" },
          { icon: Crosshair, title: "Hackathon Window Filter", desc: "Only counts commits made between April 2–4. No pre-built code cheating" },
          { icon: TrafficCone, title: "Smart Status Logic", desc: "Active, Idle, Inactive, or Error — classified by real activity not assumptions" },
          { icon: Flag, title: "Flag System", desc: "Auto-flags zero commits, solo contributors, and private repos instantly" },
          { icon: ShieldAlert, title: "Rate Limit Protection", desc: "Tiered API strategy with graceful degradation keeps the tool alive all event" },
          { icon: Download, title: "CSV Export", desc: "Download full team report for judges at any point during the hackathon" }
        ].map((feature, i) => (
          <motion.div
            key={i}
            className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (i % 3) * 0.1, duration: 0.5 }}
            style={{ willChange: "transform", transform: "translateZ(0)" }}
          >
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <feature.icon className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
            <p className="text-white/90 font-light leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
