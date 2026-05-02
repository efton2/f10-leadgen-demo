import { NextRequest, NextResponse } from "next/server";

export interface Lead {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  types: string[];
}

export async function POST(req: NextRequest) {
  const { niche, city } = await req.json();

  if (!niche || !city) {
    return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
  }

  const query = `${niche} in ${city}`;
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Places API error: ${err}` }, { status: 502 });
  }

  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json({ error: `Places API: ${data.status} ${data.error_message ?? ""}` }, { status: 502 });
  }

  const results = (data.results ?? []) as Record<string, unknown>[];

  const leads: Lead[] = results
    .filter((p) => p.business_status === "OPERATIONAL" || !p.business_status)
    .slice(0, 10)
    .map((p) => ({
      placeId: (p.place_id as string) ?? "",
      name: (p.name as string) ?? "Unknown Business",
      address: (p.formatted_address as string) ?? "",
      rating: (p.rating as number) ?? 0,
      reviewCount: (p.user_ratings_total as number) ?? 0,
      types: ((p.types as string[]) ?? []).slice(0, 3),
    }));

  return NextResponse.json({ leads, query });
}
