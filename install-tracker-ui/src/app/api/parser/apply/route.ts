import { NextResponse } from "next/server";
import { parseSlackMessage } from "@/lib/parser";
import { processParserResults } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });

    const blocks = parseSlackMessage(text);
    if (blocks.length === 0) {
      return NextResponse.json({ error: "No valid partner blocks found" }, { status: 400 });
    }

    const stats = await processParserResults(blocks);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("POST /parser/apply error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ error: message, detail: stack }, { status: 500 });
  }
}
