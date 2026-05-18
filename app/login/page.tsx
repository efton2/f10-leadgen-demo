"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Incorrect password.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-f10-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl text-f10-text text-center mb-2">F10 Strategy</h1>
        <p className="font-body text-sm text-gray-400 text-center mb-8">Internal Sales Platform</p>

        <form onSubmit={handleSubmit} className="bg-f10-tint rounded-f10 border border-f10-border p-8">
          <label className="block font-body text-sm text-gray-400 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-f10-border bg-f10-bg text-f10-text rounded-lg px-4 py-3 font-body text-sm focus:outline-none focus:ring-2 focus:ring-f10-primary mb-4"
            placeholder="Enter access password"
            autoFocus
            required
          />
          {error && <p className="font-body text-sm text-red-400 mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-f10-primary text-white font-body text-sm font-medium py-3 rounded-lg hover:bg-[#C8870A] disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
