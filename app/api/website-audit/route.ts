import { NextRequest } from "next/server";
import { cleanUrl, scrapeWebsite, runAudit, buildAuditHtml } from "@/lib/enrichment/websiteAudit";

export const maxDuration = 300;

// ── SSE handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { website, business_name } = body as { website: string; business_name: string };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "step", step: "fetch", status: "active" });
        send({ type: "log", msg: `Fetching ${cleanUrl(website)}...` });

        const { content: websiteContent, method: scrapeMethod } = await scrapeWebsite(website);

        send({ type: "step", step: "fetch", status: "done" });
        send({ type: "log", msg: `Scraped via ${scrapeMethod}` });
        send({ type: "step", step: "analyze", status: "active" });
        send({ type: "log", msg: "Running AI analysis across 5 dimensions..." });

        const audit = await runAudit(business_name, cleanUrl(website), websiteContent);

        send({ type: "step", step: "analyze", status: "done" });
        send({ type: "step", step: "score", status: "active" });
        send({ type: "log", msg: "Scoring and identifying findings..." });

        await new Promise((r) => setTimeout(r, 500));

        send({ type: "step", step: "score", status: "done" });
        send({ type: "step", step: "build", status: "active" });
        send({ type: "log", msg: "Building PDF report..." });

        const html = buildAuditHtml(business_name, cleanUrl(website), audit);

        send({ type: "step", step: "build", status: "done" });
        send({ type: "done", html, score: audit.overall_score });
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
