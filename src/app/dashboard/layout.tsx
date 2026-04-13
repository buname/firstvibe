"use client";

import { useState, useEffect, startTransition } from "react";
import AccessKeyModal from "@/components/AccessKeyModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    startTransition(() => {
      const key = localStorage.getItem("bex-access-key");
      if (key && key.trim().length >= 4) {
        setAuthenticated(true);
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#080808]">
        <div className="text-center">
          <div className="text-sm font-bold text-[#f0f0f0] mb-3 font-mono tracking-[3px]">
            BEX
          </div>
          <div className="w-5 h-5 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <AccessKeyModal onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <>{children}</>;
}
