import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

interface PageTransitionProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content with a subtle fade-up entrance animation.
 */
export default function PageTransition({
  children,
  className,
  ...rest
}: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Helper for staggered list items (cards, rows, etc.)
 */
export function StaggerItem({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: "easeOut",
        delay: index * 0.06,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
