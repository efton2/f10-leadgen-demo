import { NextRequest } from "next/server";
import {
  BRANDS,
  scrapeGoogleMaps,
  crawlCompetitorSite,
  synthesize,
  buildCompetitiveHtml,
} from "@/lib/enrichment/competitive";

export const maxDuration = 300;

// ── SSE handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_name, industry, market, market_display, competitors, brand } = body;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "log", msg: `Scraping ${competitors.length} competitors in parallel...` });

        const competitorsRaw = await Promise.all(
          competitors.map(async (name: string) => {
            send({ type: "log", msg: `Scraping: ${name}` });
            const maps = await scrapeGoogleMaps(name, market);
            const website = await crawlCompetitorSite(maps.website as string | null);
            return { ...maps, website_text: website };
          })
        );

        send({ type: "log", msg: "Synthesizing with Claude..." });
        const synthesis = await synthesize(
          client_name, industry, market_display || market,
          BRANDS[brand]?.name ?? "F10 Strategy", competitorsRaw
        );

        send({ type: "log", msg: "Building report..." });
        const html = buildCompetitiveHtml({
          client_name, industry,
          market_display: market_display || market,
          ...synthesis,
        }, brand);

        send({ type: "done", html });
      } catch (err) {
        send({ type: "error", msg: String(err) });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
