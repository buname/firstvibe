"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="min-h-full flex flex-col"
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <Toaster
        position="top-right"
        richColors
        theme="dark"
        toastOptions={{
          style: {
            border: "1px solid #1f1f1f",
            background: "#0d0d0d",
            color: "#f0f0f0",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
          },
        }}
      />
    </>
  );
}
