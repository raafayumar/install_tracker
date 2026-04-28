/**
 * GET    /api/installs/:id — Fetch a single install with pipeline state
 * PATCH  /api/installs/:id — Update install fields (status, model flags, etc.)
 *
 * Pipeline state is derived from site_stage_history (latest batch).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PipelineState, PipelineTypeState, StageEntry, StageName } from "@/types";

export const dynamic = "force-dynamic";

/** Derive current pipeline state from site_stage_history for a given install */
async function getPipelineState(comp_site_id: string): Promise<PipelineState> {
  const latestEntry = await prisma.site_stage_history.findFirst({
    where: { comp_site_id },
    orderBy: { created_at: "desc" },
    select: { batch_id: true },
  });

  if (!latestEntry) return { OB: null, PPE: null };

  const entries = await prisma.site_stage_history.findMany({
    where: { comp_site_id, batch_id: latestEntry.batch_id },
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

  return {
    OB: buildTypeState(entries.filter((e) => e.pipeline_type === "OB")),
    PPE: buildTypeState(entries.filter((e) => e.pipeline_type === "PPE")),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const install = await prisma.installs.findUnique({
      where: { comp_site_id: id },
    });

    if (!install) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...install,
      pipeline_state: await getPipelineState(id),
    });
  } catch (err) {
    console.error("GET /installs/[id] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      "status", "site_name", "owner_name", "install_type", "region",
      "jira_link", "general_od_model", "general_ppe_model",
      "ob_deployed", "ppe_deployed", "start_date", "end_date",
    ];

    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        if ((key === "start_date" || key === "end_date") && body[key]) {
          data[key] = new Date(body[key]);
        } else {
          data[key] = body[key];
        }
      }
    }

    // Auto-set end_date when marking Complete
    if (body.status === "Complete" && !body.end_date) {
      const existing = await prisma.installs.findUnique({ where: { comp_site_id: id } });
      if (existing && !existing.end_date) {
        data.end_date = new Date();
      }
    }

    const install = await prisma.installs.update({
      where: { comp_site_id: id },
      data,
    });

    return NextResponse.json({
      ...install,
      pipeline_state: await getPipelineState(id),
    });
  } catch (err) {
    console.error("PATCH /installs/[id] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
