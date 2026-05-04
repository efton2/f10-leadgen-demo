"use client";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  // Don't show nav on the login page
  if (pathname === "/login") return null;

  return (
    <nav className="bg-white border-b border-gray-100 px-8 py-3 flex items-center justify-between">
      <a href="/" className="font-heading text-lg text-f10-primary font-semibold">
        F10 Strategy
      </a>
      <div className="flex items-center gap-6">
        <a href="/" className="font-body text-sm text-gray-600 hover:text-f10-primary transition-colors">
          Search
        </a>
        <a href="/pipeline" className="font-body text-sm text-gray-600 hover:text-f10-primary transition-colors">
          Pipeline
        </a>
        <a href="/clients" className="font-body text-sm text-gray-600 hover:text-f10-primary transition-colors">
          Clients
        </a>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="font-body text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Sign Out
          </button>
        </form>
      </div>
    </nav>
  );
}
