// app/clients/page.tsx
import { supabase } from "@/lib/supabase";
import ClientsClient from "./ClientsClient";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-f10-bg p-8">
        <p className="font-body text-red-500">Failed to load clients: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-f10-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-heading text-3xl text-f10-text mb-2">Active Clients</h1>
        <p className="font-body text-sm text-gray-400 mb-8">{clients?.length ?? 0} clients on record</p>
        <ClientsClient initialClients={clients ?? []} />
      </div>
    </main>
  );
}
