import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface StarButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
}

export function StarButton({ children, className = "", disabled, ...props }: StarButtonProps) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center px-10 py-4 font-semibold text-white transition-all duration-300 rounded-full group ${
        disabled
          ? "bg-white/5 text-white/40 cursor-not-allowed border-white/5 border"
          : "bg-gradient-to-r from-cyan-500 to-orange-500 shadow-lg hover:shadow-xl hover:from-cyan-400 hover:to-orange-400 cursor-pointer"
      } ${className}`}
      {...props}
    >
      {!disabled && (
        <span className="absolute inset-0 rounded-full w-full h-full border border-white/20 z-0 pointer-events-none group-hover:border-white/40 group-hover:animate-pulse" />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
