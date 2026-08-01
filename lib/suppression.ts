import { supabase } from "@/lib/supabase";

export async function isSuppressed(email: string): Promise<boolean> {
  if (!email) return false;
  const { data } = await supabase
    .from("suppressed_emails")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data;
}

export async function addSuppression(
  email: string,
  reason: "bounced" | "complained" | "manual",
  source: string
): Promise<void> {
  if (!email) return;
  await supabase
    .from("suppressed_emails")
    .upsert({ email: email.toLowerCase(), reason, source }, { onConflict: "email" });
}
