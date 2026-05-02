import Anthropic from "@anthropic-ai/sdk";

export interface LeadDetail {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  types: string[];
  hours: string[];
  snapshot: string;
}

export async function getLeadDetail(placeId: string): Promise<LeadDetail | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const fields = [
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "rating",
    "user_ratings_total",
    "types",
    "opening_hours",
    "reviews",
  ].join(",");

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", fields);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "en");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error("[getLeadDetail] Places API HTTP error:", res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    if (data.status !== "OK") {
      console.error("[getLeadDetail] Places API status:", data.status, data.error_message ?? "");
      return null;
    }

    const p = data.result as Record<string, unknown>;
    const hours = ((p.opening_hours as Record<string, unknown>)?.weekday_text as string[]) ?? [];
    const reviews = ((p.reviews as Record<string, unknown>[]) ?? []).slice(0, 3);

    const detail: Omit<LeadDetail, "snapshot"> = {
      placeId,
      name: (p.name as string) ?? "",
      address: (p.formatted_address as string) ?? "",
      phone: (p.formatted_phone_number as string) ?? "",
      website: (p.website as string) ?? "",
      rating: (p.rating as number) ?? 0,
      reviewCount: (p.user_ratings_total as number) ?? 0,
      types: ((p.types as string[]) ?? []).slice(0, 4),
      hours,
    };

    let snapshot = "";
    const anthropicKey = process.env.F10_ANTHROPIC_KEY;
    if (anthropicKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        const reviewText = reviews
          .map((r) => `"${(r.text as string)?.slice(0, 150)}"`)
          .join(" | ");

        const msg = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: `Write a single sharp paragraph (3 to 4 sentences) summarizing this local business as a sales opportunity for an AI receptionist service. Focus on their strengths, how busy they appear, and why they could benefit from AI call handling. Do not use dashes. Business: ${detail.name}. Address: ${detail.address}. Rating: ${detail.rating} stars from ${detail.reviewCount} reviews. Hours: ${hours.slice(0, 3).join(", ")}. Recent review highlights: ${reviewText || "Not available"}.`,
            },
          ],
        });

        snapshot = (msg.content[0] as { text: string }).text;
      } catch {
        snapshot = "";
      }
    }

    return { ...detail, snapshot };
  } catch (err) {
    console.error("[getLeadDetail] Unexpected error:", err);
    return null;
  }
}
