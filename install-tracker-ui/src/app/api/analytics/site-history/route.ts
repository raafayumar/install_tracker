import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pipelinetype } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const compSiteId = request.nextUrl.searchParams.get("comp_site_id");
    const pipeline = request.nextUrl.searchParams.get("pipeline");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (compSiteId) where.comp_site_id = compSiteId;
    if (pipeline && pipeline !== "All") {
      where.pipeline_type = pipeline as pipelinetype;
    }

    const history = await prisma.site_stage_history.findMany({
      where,
      orderBy: { batch_id: "asc" },
    });

    const result = history.map((h) => ({
      ...h,
      batch_date: h.batch_id.slice(0, 10),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /analytics/site-history error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
