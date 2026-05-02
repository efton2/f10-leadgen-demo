"use client";

import { useState, useCallback, useRef } from "react";
import { Conversation } from "@11labs/client";

type OrbState = "idle" | "connecting" | "listening" | "speaking" | "error";
type Session = Awaited<ReturnType<typeof Conversation.startSession>>;

interface Props {
  name: string;
  niche: string;
  phone: string;
}

export default function ReceptionistOrb({ name, niche, phone }: Props) {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const sessionRef = useRef<Session | null>(null);

  const statusText: Record<OrbState, string> = {
    idle: "Tap to start the AI receptionist",
    connecting: "Connecting...",
    listening: "Listening...",
    speaking: `${name} receptionist is speaking`,
    error: "Connection failed. Tap to try again.",
  };

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
        console.error("Receptionist:", msg);
        sessionRef.current = null;
        setOrbState("error");
      },
    };

    try {
      const res = await fetch("/api/receptionist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, niche, phone }),
      });
      if (!res.ok) throw new Error("Token fetch failed");
      const data: { signedUrl?: string; agentId?: string } = await res.json();

      await navigator.mediaDevices.getUserMedia({ audio: true });

      if (data.signedUrl) {
        sessionRef.current = await Conversation.startSession({
          signedUrl: data.signedUrl,
          ...callbacks,
        });
      } else if (data.agentId) {
        sessionRef.current = await Conversation.startSession({
          agentId: data.agentId,
          connectionType: "webrtc",
          ...callbacks,
        });
      } else {
        throw new Error("No session config returned");
      }
    } catch (err) {
      console.error("start error:", err);
      sessionRef.current = null;
      setOrbState("error");
    }
  }, [name, niche, phone]);

  const stop = useCallback(async () => {
    await sessionRef.current?.endSession();
    sessionRef.current = null;
    setOrbState("idle");
  }, []);

  const isActive = orbState === "listening" || orbState === "speaking";
  const isConnecting = orbState === "connecting";

  return (
    <div className="bg-white rounded-f10 border border-f10-border p-8 flex flex-col items-center gap-6">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-f10-primary flex items-center justify-center">
          <span className="text-white text-[9px] font-semibold">AI</span>
        </div>
        <h2 className="font-heading text-xl font-semibold text-f10-text">AI Receptionist</h2>
      </div>

      {/* Orb */}
      <button
        onClick={isActive ? stop : start}
        disabled={isConnecting}
        aria-label={isActive ? "End call" : "Start call"}
        className="relative w-28 h-28 rounded-full focus:outline-none disabled:cursor-not-allowed"
      >
        {isActive && (
          <>
            <span className="absolute inset-0 rounded-full bg-f10-primary opacity-20 animate-ping" />
            <span className="absolute inset-2 rounded-full bg-f10-primary opacity-15 animate-ping [animation-delay:300ms]" />
          </>
        )}
        <span
          className={`absolute inset-0 rounded-full flex items-center justify-center transition-all duration-300 ${
            isConnecting
              ? "bg-gray-300 animate-pulse"
              : isActive
              ? "bg-f10-primary shadow-lg shadow-f10-primary/40"
              : orbState === "error"
              ? "bg-red-400"
              : "bg-f10-primary hover:bg-[#3d5e8e] hover:shadow-lg hover:shadow-f10-primary/30"
          }`}
        >
          {isActive ? (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </span>
      </button>

      <p className="font-body text-sm text-gray-500 text-center">{statusText[orbState]}</p>

      {isActive && (
        <p className="font-body text-xs text-f10-primary text-center">
          Speaking with the AI receptionist for {name}
        </p>
      )}
    </div>
  );
}
