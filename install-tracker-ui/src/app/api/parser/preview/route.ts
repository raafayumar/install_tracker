import { NextResponse } from "next/server";
import { parseSlackMessage } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { text } = await request.json();
  if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });

  const blocks = parseSlackMessage(text);
  return NextResponse.json(blocks);
}
