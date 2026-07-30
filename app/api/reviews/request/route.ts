import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { reviewRequestHtml, reviewReminderHtml } from "@/lib/email/templates";
import { sendTelegram } from "@/lib/telegram";

// NOTE: only f10strategy.com is verified in Resend (checked 2026-07-02).
// Switch to reviews@simporic.com once that domain is added and verified.
const FROM = "Simporic Reviews <proposals@f10strategy.com>";
const REMINDER_DELAY_DAYS = 3;

// POST /api/reviews/request — v1 manual trigger. One customer, one review
// link, no gating branch (Google review-solicitation compliance). Reminder
// fires on a fixed delay, not on review-detection — that needs the Google
// Business Profile API, deferred to v2.
export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { client_id, customer_name, customer_email } = body;

  if (!client_id || !customer_name || !customer_email) {
    return NextResponse.json(
      { error: "client_id, customer_name, and customer_email are required" },
      { status: 400 }
    );
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("business_name, google_review_link")
    .eq("id", client_id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!client.google_review_link) {
    return NextResponse.json(
      { error: "Client has no Google review link set yet" },
      { status: 400 }
    );
  }

  const { data: reviewRequest, error: insertError } = await supabase
    .from("review_requests")
    .insert({ client_id, customer_name, customer_email, status: "queued" })
    .select()
    .single();

  if (insertError || !reviewRequest) {
    return NextResponse.json({ error: "Failed to create review request" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const businessName = client.business_name as string;
  const reviewLink = client.google_review_link as string;

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: [customer_email],
    subject: `Quick favor, ${businessName}?`,
    html: reviewRequestHtml(businessName, customer_name, reviewLink),
  });

  if (sendError) {
    await supabase
      .from("review_requests")
      .update({ status: "failed", error: `Send failed: ${sendError.message ?? sendError}` })
      .eq("id", reviewRequest.id);
    return NextResponse.json({ error: `Send failed: ${sendError.message ?? "Resend error"}` }, { status: 502 });
  }

  let reminderError = "";
  try {
    const reminderAt = new Date(
      Date.now() + REMINDER_DELAY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    await resend.emails.send({
      from: FROM,
      to: [customer_email],
      subject: `One more ask, ${businessName}?`,
      html: reviewReminderHtml(businessName, customer_name, reviewLink),
      scheduledAt: reminderAt,
    });
  } catch (err) {
    reminderError = `Reminder scheduling failed: ${String(err)}`;
  }

  const { data: updatedRequest } = await supabase
    .from("review_requests")
    .update({
      status: "sent",
      requested_at: new Date().toISOString(),
      error: reminderError,
    })
    .eq("id", reviewRequest.id)
    .select()
    .single();

  await sendTelegram(
    [
      "⭐ REVIEW REQUEST SENT",
      "",
      `Business: ${businessName}`,
      `Customer: ${customer_name} <${customer_email}>`,
      `Reminder scheduled: +${REMINDER_DELAY_DAYS}d`,
      reminderError ? `⚠️ ${reminderError}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return NextResponse.json({
    success: true,
    reviewRequest: updatedRequest ?? reviewRequest,
    reminderError: reminderError || undefined,
  });
}
