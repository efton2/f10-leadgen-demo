"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Conversation } from "@11labs/client";

type OrbState = "idle" | "connecting" | "listening" | "speaking" | "error";
type Session = Awaited<ReturnType<typeof Conversation.startSession>>;

function AceOrbInner() {
  const searchParams = useSearchParams();
  const signedUrl = searchParams.get("signedUrl");
  const agentId = searchParams.get("agentId");
  const clientName = searchParams.get("clientName") ?? "this prospect";

  const [orbState, setOrbState] = useState<OrbState>("idle");
  const sessionRef = useRef<Session | null>(null);

  // Auto-prompt mic on mount so the user just taps the orb
  useEffect(() => {
    if (!signedUrl && !agentId) return;
  }, [signedUrl, agentId]);

  const start = useCallback(async () => {
    if (sessionRef.current) return;
    setOrbState("connecting");

    const callbacks = {
      onConnect: () => setOrbState("listening"),
      onDisconnect: () => {
        sessionRef.current = null;
        setOrbState("idle");
      },
      onModeChange: ({ mode }: { mode: "speaking" | "listening" }) =>
        setOrbState(mode === "speaking" ? "speaking" : "listening"),
      onError: (msg: string) => {
        console.error("ACE:", msg);
        sessionRef.current = null;
        setOrbState("error");
      },
    };

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      if (signedUrl) {
        sessionRef.current = await Conversation.startSession({ signedUrl, ...callbacks });
      } else if (agentId) {
        sessionRef.current = await Conversation.startSession({
          agentId,
          connectionType: "webrtc",
          ...callbacks,
        });
      } else {
        throw new Error("No session configuration");
      }
    } catch (err) {
      console.error("ACE start error:", err);
      sessionRef.current = null;
      setOrbState("error");
    }
  }, [signedUrl, agentId]);

  const stop = useCallback(async () => {
    await sessionRef.current?.endSession();
    sessionRef.current = null;
    setOrbState("idle");
  }, []);

  const isActive = orbState === "listening" || orbState === "speaking";
  const isConnecting = orbState === "connecting";

  if (!signedUrl && !agentId) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <p className="text-amber-400 font-mono text-sm">No session configured. Close this tab and try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center gap-8 px-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center">
          <span className="text-[#0D1B2A] text-sm font-bold tracking-wider">ACE</span>
        </div>
        <h1 className="text-white text-2xl font-semibold tracking-wide" style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}>
          ACE Sales Closer
        </h1>
        <p className="text-amber-400/70 text-xs font-mono uppercase tracking-widest">
          Praeco Intelligence Session
        </p>
      </div>

      {/* Orb */}
      <button
        onClick={isActive ? stop : start}
        disabled={isConnecting}
        aria-label={isActive ? "End session" : "Start ACE session"}
        className="relative w-36 h-36 rounded-full focus:outline-none disabled:cursor-not-allowed"
      >
        {isActive && (
          <>
            <span className="absolute inset-0 rounded-full bg-amber-400 opacity-15 animate-ping" />
            <span className="absolute inset-3 rounded-full bg-amber-400 opacity-10 animate-ping [animation-delay:400ms]" />
          </>
        )}
        <span
          className={`absolute inset-0 rounded-full flex items-center justify-center transition-all duration-300 ${
            isConnecting
              ? "bg-amber-900 animate-pulse"
              : isActive
              ? "bg-amber-400 shadow-lg shadow-amber-400/40"
              : orbState === "error"
              ? "bg-red-700"
              : "bg-amber-400 hover:bg-amber-300 hover:shadow-lg hover:shadow-amber-400/30"
          }`}
        >
          {isActive ? (
            <svg className="w-10 h-10 text-[#0D1B2A]" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-[#0D1B2A]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </span>
      </button>

      {/* Status */}
      <div className="text-center">
        <p className="text-white/80 text-sm font-mono">
          {orbState === "idle" && "Tap to start the ACE session"}
          {orbState === "connecting" && "Connecting ACE..."}
          {orbState === "listening" && "ACE is listening"}
          {orbState === "speaking" && "ACE is speaking"}
          {orbState === "error" && "Connection failed — tap to retry"}
        </p>
        {isActive && (
          <p className="text-amber-400/60 text-xs mt-2 font-mono">
            Loaded with competitive intelligence for {clientName}
          </p>
        )}
      </div>

      {/* Intel badge */}
      <div className="border border-amber-400/20 rounded-lg px-5 py-3 text-center max-w-xs">
        <p className="text-amber-400/80 text-xs font-mono uppercase tracking-wider mb-1">Intelligence Active</p>
        <p className="text-white/50 text-xs">
          Competitive market data for {clientName} is loaded and ready.
        </p>
      </div>
    </div>
  );
}

export default function AceSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    }>
      <AceOrbInner />
    </Suspense>
  );
}
