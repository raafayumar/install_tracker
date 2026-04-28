/**
 * GET /api/installs  — List installs with their current pipeline state
 * POST /api/installs — Register a new install (or fill details on parser-created skeleton)
 *
 * Pipeline state is derived from the latest batch in site_stage_history, NOT from
 * a separate "pipelines" table. This correctly handles multiple partners per site.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PipelineState, PipelineTypeState, StageEntry, StageName } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Derive the current pipeline state for a single install from site_stage_history.
 * Returns { OB: { partners, stages, no_data }, PPE: { ... } }
 */
async function getPipelineState(comp_site_id: string): Promise<PipelineState> {
  // Find the latest batch for this site
  const latestEntry = await prisma.site_stage_history.findFirst({
    where: { comp_site_id },
    orderBy: { created_at: "desc" },
    select: { batch_id: true },
  });

  const emptyType: PipelineTypeState = { partners: [], stages: [], no_data: true };

  if (!latestEntry) {
    return { OB: null, PPE: null };
  }

  // Get all entries from the latest batch for this site
  const entries = await prisma.site_stage_history.findMany({
    where: { comp_site_id, batch_id: latestEntry.batch_id },
  });

  // Group by pipeline_type
  const obEntries = entries.filter((e) => e.pipeline_type === "OB");
  const ppeEntries = entries.filter((e) => e.pipeline_type === "PPE");

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
    OB: buildTypeState(obEntries),
    PPE: buildTypeState(ppeEntries),
  };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const owner = params.get("owner");
    const status = params.get("status");
    const region = params.get("region");
    const type = params.get("type");
    const search = params.get("search");

    // Build where clause for installs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (owner && owner !== "All") where.owner_name = owner;
    if (status && status !== "All") where.status = status;
    if (region && region !== "All") where.region = region;
    if (type && type !== "All") where.install_type = type;

    if (search) {
      where.OR = [
        { comp_site_id: { contains: search, mode: "insensitive" } },
        { site_name: { contains: search, mode: "insensitive" } },
        { owner_name: { contains: search, mode: "insensitive" } },
      ];
    }

    const installs = await prisma.installs.findMany({
      where,
      orderBy: { comp_site_id: "asc" },
    });

    // Enrich each install with its current pipeline state from site_stage_history
    const enriched = await Promise.all(
      installs.map(async (install) => ({
        ...install,
        pipeline_state: await getPipelineState(install.comp_site_id),
      }))
    );

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("GET /installs error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { comp_site_id, site_name, install_type, region, jira_link, owner_name } = body;

    if (!comp_site_id) {
      return NextResponse.json({ error: "comp_site_id required" }, { status: 400 });
    }

    const trimmedId = comp_site_id.trim();

    // Check if install already exists (e.g., created by parser from Slack with no owner/details)
    const existing = await prisma.installs.findUnique({ where: { comp_site_id: trimmedId } });

    if (existing) {
      // Update the existing record with the missing details (upsert pattern)
      const install = await prisma.installs.update({
        where: { comp_site_id: trimmedId },
        data: {
          site_name: site_name || existing.site_name,
          install_type: install_type || existing.install_type,
          region: region || existing.region,
          jira_link: jira_link || existing.jira_link,
          owner_name: owner_name || existing.owner_name,
          start_date: existing.start_date || new Date(),
        },
      });
      return NextResponse.json({
        ...install,
        pipeline_state: await getPipelineState(trimmedId),
      }, { status: 200 });
    }

    const install = await prisma.installs.create({
      data: {
        comp_site_id: trimmedId,
        site_name: site_name || null,
        install_type: install_type || "New Site",
        region: region || "US",
        jira_link: jira_link || null,
        owner_name: owner_name || null,
        start_date: new Date(),
      },
    });

    return NextResponse.json({
      ...install,
      pipeline_state: { OB: null, PPE: null },
    }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /installs error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
