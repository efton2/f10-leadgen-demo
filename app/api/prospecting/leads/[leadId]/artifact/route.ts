import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/prospecting/leads/[leadId]/artifact?type=audit|competitive
// Serves the stored HTML report for viewing in a new tab.
export async function GET(req: NextRequest, { params }: { params: { leadId: string } }) {
  const type = req.nextUrl.searchParams.get("type");
  if (type !== "audit" && type !== "competitive") {
    return NextResponse.json({ error: "type must be audit or competitive" }, { status: 400 });
  }

  const column = type === "audit" ? "audit_html" : "competitive_html";
  const { data, error } = await supabase
    .from("prospecting_leads")
    .select(column)
    .eq("id", params.leadId)
    .single();

  const html = (data as Record<string, string | null> | null)?.[column];
  if (error || !html) {
    return NextResponse.json({ error: "Report not available for this lead yet" }, { status: 404 });
  }

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
