/**
 * GET /api/analytics/kpis — High-level KPI metrics for the analytics page.
 *
 * "No data" count is derived by checking which in-progress installs
 * have NO rows in the latest global batch of site_stage_history.
 * (Previously used the now-removed pipelines.data_status field.)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [active, completed, allComplete] = await Promise.all([
      prisma.installs.count({ where: { status: "In-progress" } }),
      prisma.installs.count({ where: { status: "Complete" } }),
      prisma.installs.findMany({
        where: { status: "Complete", start_date: { not: null }, end_date: { not: null } },
        select: { start_date: true, end_date: true },
      }),
    ]);

    // Avg days to complete
    let avgDays = 0;
    if (allComplete.length > 0) {
      const totalDays = allComplete.reduce((sum, i) => {
        const start = new Date(i.start_date!);
        const end = new Date(i.end_date!);
        return sum + Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDays = Math.round(totalDays / allComplete.length);
    }

    // "No data" = in-progress installs missing from the latest global batch
    const latestBatch = await prisma.site_stage_history.findFirst({
      orderBy: { created_at: "desc" },
      select: { batch_id: true },
    });

    let noDataCount = 0;
    if (latestBatch) {
      const sitesWithData = await prisma.site_stage_history.findMany({
        where: { batch_id: latestBatch.batch_id },
        select: { comp_site_id: true },
        distinct: ["comp_site_id"],
      });
      const siteSet = new Set(sitesWithData.map((s) => s.comp_site_id));

      const inProgress = await prisma.installs.findMany({
        where: { status: "In-progress" },
        select: { comp_site_id: true },
      });
      noDataCount = inProgress.filter((i) => !siteSet.has(i.comp_site_id)).length;
    }

    return NextResponse.json({
      activeInstalls: active,
      completed,
      avgDaysToComplete: avgDays,
      noDataCount,
    });
  } catch (err) {
    console.error("GET /analytics/kpis error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
