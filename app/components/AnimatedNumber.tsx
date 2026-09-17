"use client";
import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
}

export function AnimatedNumber({ value, format, style }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1200, bounce: 0 });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => {
    return spring.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = format ? format(latest) : Math.round(latest).toLocaleString();
      }
    });
  }, [spring, format]);

  return <motion.span ref={ref} style={style}>0</motion.span>;
}
