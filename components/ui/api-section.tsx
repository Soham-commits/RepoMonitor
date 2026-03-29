"use client"
import { motion } from "framer-motion"
import { School, Clock, Users, Calendar } from "lucide-react"
import Link from "next/link"

export default function APISection() {
  return (
    <section id="event-stats" className="relative z-20 max-w-7xl mx-auto px-6 py-32 mb-20">
      <div className="grid lg:grid-cols-2 gap-16 items-stretch">
        <motion.div
          className="p-10 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-center"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{ willChange: "transform", transform: "translateZ(0)" }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-orange-400">Ignisia 2026</span>
          </h2>
          <p className="text-xl text-white/90 font-light leading-relaxed mb-8">
            A 24-hour national AI hackathon at MIT World Peace University, Pune. One tool built to keep 100 teams accountable, transparent, and competitive.
          </p>
          <motion.div className="flex items-center gap-4 w-full max-w-xl">
            <a href="https://ignisia.tech" target="_blank" rel="noopener noreferrer" className="flex-1">
              <motion.button
                className="w-full px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all duration-300 backdrop-blur-md cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Website
              </motion.button>
            </a>
            <Link href="/signup" className="flex-1">
              <motion.button
                className="w-full px-10 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-orange-500 text-white font-semibold text-sm transition-all duration-300 hover:from-cyan-400 hover:to-orange-400 cursor-pointer shadow-lg hover:shadow-xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Monitoring
              </motion.button>
            </Link>
          </motion.div>
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
            { label: "MIT-WPU", value: "MIT-WPU", sub: "Pune, Maharashtra", icon: School },
            { label: "24 Hours", value: "24 Hours", sub: "April 3-4, 2026", icon: Clock },
            { label: "100+ Teams", value: "100+ Teams", sub: "Across 5 problem statements", icon: Users },
            { label: "April 2", value: "April 2", sub: "PS Release & Kickoff", icon: Calendar }
          ].map((stat, i) => (
            <div key={i} className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl group hover:border-white/20 hover:bg-white/10 transition-all flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <stat.icon className="w-5 h-5 text-orange-400 group-hover:text-cyan-400 transition-colors" />
                <span className="text-sm font-medium text-white/70">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-bold text-white">{stat.value}</span>
                {stat.sub && <span className="text-white/60 font-medium">{stat.sub}</span>}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
