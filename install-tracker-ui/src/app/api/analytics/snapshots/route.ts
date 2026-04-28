import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pipelinetype } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pipeline = request.nextUrl.searchParams.get("pipeline");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (pipeline && pipeline !== "All") {
      where.pipeline_type = pipeline as pipelinetype;
    }

    const snapshots = await prisma.stage_snapshots.findMany({
      where,
      orderBy: { batch_id: "asc" },
    });

    const result = snapshots.map((s) => ({
      ...s,
      batch_date: s.batch_id.slice(0, 10),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /analytics/snapshots error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
