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
          ? "bg-white/8 text-white/45 cursor-not-allowed border-white/15 border"
          : "bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] shadow-lg hover:shadow-xl hover:from-[#6A3DFF] hover:to-[#B06CFF] cursor-pointer"
      } ${className}`}
      {...props}
    >
      {!disabled && (
        <span className="absolute inset-0 rounded-full w-full h-full border border-white/15 z-0 pointer-events-none group-hover:border-white/30 group-hover:animate-pulse" />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
