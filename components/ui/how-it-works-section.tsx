"use client"
import { motion } from "framer-motion"
import { Key, Link as LinkIcon, Play } from "lucide-react"

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 md:py-32">
      <div className="text-center mb-12 sm:mb-16">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">Live in 3 Steps</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-5 sm:gap-8">
        {[
          { icon: Key, title: "1", desc: "Generate a free GitHub PAT — Create a Personal Access Token at github.com/settings/tokens. Only public_repo read scope needed." },
          { icon: LinkIcon, title: "2", desc: "Paste all 100 team repo URLs — One URL per line or import directly from your team submission Excel sheet." },
          { icon: Play, title: "3", desc: "Dashboard goes live — Auto-refreshes every 8 minutes. Status, commits, flags - all updated silently in the background." }
        ].map((step, i) => (
          <motion.div
            key={i}
            className="relative p-6 sm:p-8 rounded-3xl bg-white/5 backdrop-blur-md border border-white/15 overflow-hidden group hover:bg-white/8 transition-all"
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
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1E2CFF]/20 to-[#6A3DFF]/20 border border-white/15 flex items-center justify-center mb-6 relative z-10 group-hover:bg-white/8 transition-colors">
              <step.icon className="w-8 h-8 text-white/90" />
            </div>
            <p className="text-base sm:text-lg text-white/70 font-medium leading-relaxed relative z-10">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
