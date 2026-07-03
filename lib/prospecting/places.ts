// Paginated Google Places text search for batch prospecting.
// Extends the single-page logic in app/api/leads/route.ts with
// next_page_token pagination (2s validity delay, hard cap 60 results).

export interface PlacesLead {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  category: string;
}

export async function searchPlacesPaginated(
  niche: string,
  city: string,
  count: number
): Promise<{ leads: PlacesLead[]; searchCalls: number }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Google Places API key not configured");

  const capped = Math.min(Math.max(count, 1), 60);
  const query = `${niche} in ${city}`;
  const leads: PlacesLead[] = [];
  let pageToken: string | undefined;
  let searchCalls = 0;

  for (let page = 0; page < 3 && leads.length < capped; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "en");
    if (pageToken) {
      url.searchParams.set("pagetoken", pageToken);
    } else {
      url.searchParams.set("query", query);
    }

    const res = await fetch(url.toString());
    searchCalls++;
    if (!res.ok) throw new Error(`Places API HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Places API: ${data.status} ${data.error_message ?? ""}`);
    }

    const results = (data.results ?? []) as Record<string, unknown>[];
    for (const p of results) {
      if (leads.length >= capped) break;
      if (p.business_status && p.business_status !== "OPERATIONAL") continue;
      const placeId = (p.place_id as string) ?? "";
      if (!placeId) continue;
      leads.push({
        placeId,
        name: (p.name as string) ?? "Unknown Business",
        address: (p.formatted_address as string) ?? "",
        rating: (p.rating as number) ?? 0,
        reviewCount: (p.user_ratings_total as number) ?? 0,
        category: (((p.types as string[]) ?? [])[0] ?? "").replace(/_/g, " "),
      });
    }

    pageToken = data.next_page_token as string | undefined;
    if (!pageToken || leads.length >= capped) break;
    // next_page_token takes ~2s to become valid
    await new Promise((r) => setTimeout(r, 2100));
  }

  return { leads, searchCalls };
}
