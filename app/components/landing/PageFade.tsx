"use client";
import { MotionConfig, motion } from "framer-motion";

// The one page-load animation. MotionConfig makes every motion element on
// the landing page honor prefers-reduced-motion.
export function PageFade({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </motion.main>
    </MotionConfig>
  );
}
