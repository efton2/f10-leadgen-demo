import { NextRequest } from "next/server";
import { cleanHandle, scrapeInstagram, runSocialAudit, buildSocialHtml } from "@/app/lib/socialAudit";

export const maxDuration = 300;

// ── SSE handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { handle: rawHandle, business_name } = body as { handle: string; business_name: string };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const handle = cleanHandle(rawHandle ?? "");
        if (!handle) {
          send({ type: "error", msg: "Enter a valid Instagram handle." });
          controller.close();
          return;
        }

        send({ type: "step", step: "fetch", status: "active" });
        send({ type: "log", msg: `Pulling @${handle}'s recent posts...` });

        const posts = await scrapeInstagram(handle);

        if (posts.length === 0) {
          send({ type: "step", step: "fetch", status: "done" });
          send({ type: "error", msg: "No public posts found. The account may be private, empty, or the handle is wrong." });
          controller.close();
          return;
        }

        send({ type: "step", step: "fetch", status: "done" });
        send({ type: "log", msg: `Pulled ${posts.length} posts` });
        send({ type: "step", step: "analyze", status: "active" });
        send({ type: "log", msg: "Analyzing hooks, formats, and content pillars..." });

        const audit = await runSocialAudit(business_name, handle, posts);

        send({ type: "step", step: "analyze", status: "done" });
        send({ type: "step", step: "score", status: "active" });
        send({ type: "log", msg: "Scoring content health and ranking top posts..." });

        await new Promise((r) => setTimeout(r, 500));

        send({ type: "step", step: "score", status: "done" });
        send({ type: "step", step: "build", status: "active" });
        send({ type: "log", msg: "Building branded report..." });

        const html = buildSocialHtml(business_name, handle, audit);

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
