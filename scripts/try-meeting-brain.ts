// scripts/try-meeting-brain.ts
// See Workflow #1's brain in action with NO database and NO server.
// It calls the exact same analyzeMeeting() that runs in production and prints
// the digest. Only needs F10_ANTHROPIC_KEY.
//
//   F10_ANTHROPIC_KEY=sk-ant-... npx tsx scripts/try-meeting-brain.ts
//   # or point at your own transcript:
//   F10_ANTHROPIC_KEY=sk-ant-... npx tsx scripts/try-meeting-brain.ts path/to/call.txt
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "dotenv/config";
import { analyzeMeeting } from "../lib/meeting-brain";

async function main() {
  const file = process.argv[2] ?? resolve(__dirname, "sample-transcript.txt");
  const transcript = readFileSync(file, "utf8");

  if (!process.env.F10_ANTHROPIC_KEY) {
    console.error("\n  Set F10_ANTHROPIC_KEY first, e.g.\n");
    console.error("  F10_ANTHROPIC_KEY=sk-ant-... npx tsx scripts/try-meeting-brain.ts\n");
    process.exit(1);
  }

  console.log(`\nAnalyzing: ${file}\n${"-".repeat(60)}`);
  const t0 = Date.now();
  const d = await analyzeMeeting({
    transcript,
    title: "Acme Dental — discovery call",
    host: "Efton",
    clientName: "Dr. Rivera (Acme Dental)",
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\nSUMMARY\n${d.summary}\n`);

  console.log("ACTION ITEMS");
  d.action_items.forEach((a) =>
    console.log(`  [${a.owner}] ${a.task}${a.due ? `  (due: ${a.due})` : ""}`)
  );

  console.log(`\nSENTIMENT: ${d.sentiment}`);
  console.log(`RISKS: ${d.risks.join(" | ") || "(none)"}`);

  console.log("\nDEAL READ");
  console.log(`  is_deal:   ${d.deal.is_deal}`);
  console.log(`  stage:     ${d.deal.stage}`);
  console.log(`  selling:   ${d.deal.what_selling}`);
  console.log(
    `  amount:    ${d.deal.suggested_amount != null ? `${d.deal.currency.toUpperCase()} ${d.deal.suggested_amount.toLocaleString()}` : "(unclear)"} [${d.deal.confidence} confidence]`
  );
  console.log(`  why:       ${d.deal.rationale}`);

  console.log("\nDRAFTED FOLLOW-UP EMAIL (not sent)");
  console.log(`  Subject: ${d.follow_up_email.subject}\n`);
  console.log(
    d.follow_up_email.body
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n")
  );

  console.log("\nNEXT MEETING");
  console.log(`  recommended: ${d.next_meeting.recommended} (${d.next_meeting.suggested_duration_minutes ?? "?"} min)`);
  console.log(`  purpose:     ${d.next_meeting.purpose}`);
  d.next_meeting.proposed_agenda.forEach((a) => console.log(`    - ${a}`));

  console.log(`\n${"-".repeat(60)}\nDone in ${secs}s.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
