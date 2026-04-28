import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pipelinetype } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pipeline = request.nextUrl.searchParams.get("pipeline");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { comp_site_id: id };
    if (pipeline && pipeline !== "All") {
      where.pipeline_type = pipeline as pipelinetype;
    }

    const history = await prisma.site_stage_history.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 100,
    });
    return NextResponse.json(history);
  } catch (err) {
    console.error("GET /stage-history error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
