"use client"
import { motion } from "framer-motion"
import { Key, Link as LinkIcon, Play } from "lucide-react"

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative z-20 max-w-7xl mx-auto px-6 py-32">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Up and Running in 3 Steps</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {[
          { icon: Key, title: "1", desc: "Generate a free GitHub PAT and paste it in" },
          { icon: LinkIcon, title: "2", desc: "Paste all 100 team repo URLs — one per line" },
          { icon: Play, title: "3", desc: "Hit Start. Dashboard goes live and auto-refreshes" }
        ].map((step, i) => (
          <motion.div
            key={i}
            className="relative p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden group hover:bg-white/10 transition-all"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2, duration: 0.6 }}
            style={{ willChange: "transform", transform: "translateZ(0)" }}
          >
            {/* Decorative Number */}
            <div className="absolute -right-4 -top-8 text-white/5 text-[150px] font-black pointer-events-none select-none transition-transform group-hover:scale-110">
              {step.title}
            </div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-orange-500/20 border border-white/10 flex items-center justify-center mb-6 relative z-10 group-hover:bg-white/10 transition-colors">
              <step.icon className="w-8 h-8 text-white/90" />
            </div>
            <p className="text-lg text-white/90 font-medium leading-relaxed relative z-10">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
