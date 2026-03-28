"use client"
import { motion } from "framer-motion"
import { ShieldAlert, Database, Zap, Gauge } from "lucide-react"

export default function APISection() {
  return (
    <section id="api" className="relative z-20 max-w-7xl mx-auto px-6 py-32 border-t border-white/10 mb-20 bg-black">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{ willChange: "transform", transform: "translateZ(0)" }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Powered by GitHub REST API
          </h2>
          <p className="text-xl text-white/70 font-light leading-relaxed mb-8">
            No backend. No database. Direct GitHub API calls with ETag caching, delta fetching, and smart rate gating keep 100 repos monitored reliably within the free 5000 req/hr limit.
          </p>
          <motion.button
            className="px-8 py-3 rounded-full bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Explore Architecture
          </motion.button>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 gap-6"
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ willChange: "transform", transform: "translateZ(0)" }}
        >
          {[
            { label: "Limit", value: "5,000", sub: "req/hr", icon: Database },
            { label: "per Poll", value: "~400", sub: "calls", icon: Zap },
            { label: "Refresh Interval", value: "8", sub: "min", icon: Gauge },
            { label: "Headroom", value: "82", sub: "%", icon: ShieldAlert }
          ].map((stat, i) => (
            <div key={i} className="p-6 rounded-3xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 backdrop-blur-sm group hover:border-white/20 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <stat.icon className="w-5 h-5 text-orange-400 group-hover:text-cyan-400 transition-colors" />
                <span className="text-sm font-medium text-white/70">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{stat.value}</span>
                <span className="text-white/50 font-medium">{stat.sub}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
