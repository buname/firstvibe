"use client";

import { useState } from "react";
import { KeyRound, ArrowRight } from "lucide-react";

interface Props {
  onAuthenticated: () => void;
}

export default function AccessKeyModal({ onAuthenticated }: Props) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    setLoading(true);
    setError(false);
    setTimeout(() => {
      if (key.trim().length >= 4) {
        localStorage.setItem("bex-access-key", key.trim());
        onAuthenticated();
      } else {
        setError(true);
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-[#111] border border-[#222] rounded p-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-[#161616] border border-[#222] flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-[#f0f0f0]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#f0f0f0] font-mono tracking-[3px]">
              BEX
            </h2>
            <p className="text-[10px] text-[#666] font-mono">
              Access key required
            </p>
          </div>
        </div>

        <p className="text-[#999] text-xs mb-6">
          Enter your key to open the dashboard.
        </p>

        <input
          type="text"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="BEX-XXXX-XXXX"
          className={`w-full px-4 py-3 rounded bg-[#0a0a0a] border text-[#f0f0f0] placeholder:text-[#444] focus:outline-none focus:border-[#333] transition-colors font-mono text-sm ${
            error ? "border-[#ff4444]" : "border-[#222]"
          }`}
          autoFocus
        />
        {error && (
          <p className="text-[#ff4444] text-[10px] mt-2 font-mono">
            Invalid access key
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !key.trim()}
          className="w-full mt-4 px-4 py-3 rounded bg-[#f0f0f0] hover:bg-white disabled:opacity-30 text-[#080808] font-mono font-bold text-sm flex items-center justify-center gap-2 transition-all tracking-wider"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-[#080808]/30 border-t-[#080808] rounded-full animate-spin" />
          ) : (
            <>
              CONTINUE <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-center text-[#666] text-[10px] mt-4 font-mono">
          Contact admin for a key
        </p>
      </div>
    </div>
  );
}
