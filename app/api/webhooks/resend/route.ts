import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyResendSignature } from "@/lib/resendWebhook";
import { addSuppression } from "@/lib/suppression";
import { sendTelegram } from "@/lib/telegram";

// POST /api/webhooks/resend — registered in the Resend dashboard against
// this URL. No session cookie (Resend can't hold one); authenticity comes
// from the Svix-format signature instead, same trust model as
// /api/proof/retrieve for ElevenLabs. Logs delivered/bounced/complained to
// email_events and auto-suppresses on bounce/complaint.
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const body = await req.text();
  const headers = {
    id: req.headers.get("svix-id") ?? "",
    timestamp: req.headers.get("svix-timestamp") ?? "",
    signature: req.headers.get("svix-signature") ?? "",
  };

  if (!secret || !verifyResendSignature(body, headers, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event.type ?? "";
  const data = event.data ?? {};
  const messageId = (data.email_id as string | undefined) ?? undefined;
  const recipient = (((data.to as string[] | undefined) ?? [])[0] ?? "").toLowerCase();

  const eventType: "delivered" | "bounced" | "complained" | "other" =
    type === "email.delivered" ? "delivered" : type === "email.bounced" ? "bounced" : type === "email.complained" ? "complained" : "other";

  if (eventType === "other") {
    // Ignore email.sent/opened/clicked/etc — not tracked yet, not an error.
    return NextResponse.json({ ok: true, ignored: type });
  }

  let leadId: string | null = null;
  if (messageId) {
    const { data: send } = await supabase
      .from("prospecting_sends")
      .select("lead_id")
      .eq("resend_message_id", messageId)
      .maybeSingle();
    leadId = (send?.lead_id as string | undefined) ?? null;
  }

  await supabase.from("email_events").insert({
    resend_message_id: messageId ?? null,
    recipient_email: recipient,
    event_type: eventType,
    lead_id: leadId,
    raw: event,
  });

  if ((eventType === "bounced" || eventType === "complained") && recipient) {
    await addSuppression(recipient, eventType, "resend_webhook");
    await sendTelegram(
      [
        eventType === "bounced" ? "⚠️ EMAIL BOUNCED" : "🚫 EMAIL COMPLAINT",
        "",
        `Recipient: ${recipient}`,
        leadId ? `Lead: ${leadId}` : "Lead: unmatched (no prospecting_sends record for this message id)",
        "Added to suppression list — future sends to this address are blocked.",
      ].join("\n")
    );
  }

  return NextResponse.json({ ok: true });
}
