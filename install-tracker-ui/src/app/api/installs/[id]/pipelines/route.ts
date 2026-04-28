/**
 * GET /api/installs/:id/pipelines — Get pipeline state for a single install.
 *
 * This is now a convenience endpoint that returns the same pipeline_state
 * that's included in the main install response. Derived from site_stage_history.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PipelineState, PipelineTypeState, StageEntry, StageName } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const latestEntry = await prisma.site_stage_history.findFirst({
      where: { comp_site_id: id },
      orderBy: { created_at: "desc" },
      select: { batch_id: true },
    });

    if (!latestEntry) {
      return NextResponse.json({ OB: null, PPE: null });
    }

    const entries = await prisma.site_stage_history.findMany({
      where: { comp_site_id: id, batch_id: latestEntry.batch_id },
    });

    function buildTypeState(rows: typeof entries): PipelineTypeState | null {
      if (rows.length === 0) return null;
      const partners = [...new Set(rows.map((r) => r.partner))].sort();
      const stages: StageEntry[] = rows.map((r) => ({
        partner: r.partner,
        stage_name: r.stage_name as StageName,
        frames: r.frames,
      }));
      return { partners, stages, no_data: false };
    }

    const state: PipelineState = {
      OB: buildTypeState(entries.filter((e) => e.pipeline_type === "OB")),
      PPE: buildTypeState(entries.filter((e) => e.pipeline_type === "PPE")),
    };

    return NextResponse.json(state);
  } catch (err) {
    console.error("GET /pipelines error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
