/**
 * GET /api/installs  — List installs with their current pipeline state
 * POST /api/installs — Register a new install (or fill details on parser-created skeleton)
 *
 * Pipeline state is derived from the LATEST GLOBAL BATCH in site_stage_history.
 *
 * ── THE STALE-DATA BUG (fixed here) ──────────────────────────────────────────
 * Old behaviour: getPipelineState() found the latest batch *for each site individually*.
 * So if a site (e.g. 1108-1386) appeared in yesterday's parse but NOT in today's,
 * the old code returned yesterday's data — stale and wrong.
 *
 * Fix: find the single latest batch_id across ALL of site_stage_history (one query),
 * then look up each site in that global batch. If a site is absent → it has no active
 * pipeline in the latest update, so we return { OB: null, PPE: null }.
 *
 * This also replaces N+1 per-site queries with just 2 bulk queries (global batch lookup
 * + one findMany for all entries in that batch).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PipelineState, PipelineTypeState, StageEntry, StageName } from "@/types";

export const dynamic = "force-dynamic";

// Infer the row type from Prisma so we don't have to repeat it
type SiteStageRow = Awaited<ReturnType<typeof prisma.site_stage_history.findMany>>[0];

/**
 * Build a PipelineTypeState from a list of rows for one pipeline type.
 * Returns null if there are no rows (signals "no pipeline of this type").
 */
function buildTypeState(rows: SiteStageRow[]): PipelineTypeState | null {
  if (rows.length === 0) return null;
  const partners = [...new Set(rows.map((r) => r.partner))].sort();
  const stages: StageEntry[] = rows.map((r) => ({
    partner: r.partner,
    stage_name: r.stage_name as StageName,
    frames: r.frames,
  }));
  return { partners, stages, no_data: false };
}

/**
 * Build a full PipelineState from all site_stage_history rows for one site
 * in the global batch. Pass an empty array if the site has no rows in that batch
 * (the result will be { OB: null, PPE: null }).
 */
function buildPipelineState(entries: SiteStageRow[]): PipelineState {
  const obEntries = entries.filter((e) => e.pipeline_type === "OB");
  const ppeEntries = entries.filter((e) => e.pipeline_type === "PPE");
  return {
    OB: buildTypeState(obEntries),
    PPE: buildTypeState(ppeEntries),
  };
}

/**
 * Fetch the pipeline state for a single site using the global latest batch.
 * Used by the POST handler after an upsert (can't batch since we don't have a
 * pre-fetched global batch at that point).
 */
async function getPipelineStateForSite(comp_site_id: string): Promise<PipelineState> {
  // Step 1: find the latest batch_id globally (not per-site)
  const latestGlobal = await prisma.site_stage_history.findFirst({
    orderBy: { created_at: "desc" },
    select: { batch_id: true },
  });
  if (!latestGlobal) return { OB: null, PPE: null };

  // Step 2: look up this site in that global batch
  const entries = await prisma.site_stage_history.findMany({
    where: { comp_site_id, batch_id: latestGlobal.batch_id },
  });

  // If site not in the latest batch → no current pipeline activity
  return buildPipelineState(entries);
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

    // ── Run 3 queries in parallel, then join in memory ────────────────────────

    const [installs, latestGlobal] = await Promise.all([
      prisma.installs.findMany({ where, orderBy: { comp_site_id: "asc" } }),
      // Query 1: find the single latest batch_id across ALL site_stage_history rows
      prisma.site_stage_history.findFirst({
        orderBy: { created_at: "desc" },
        select: { batch_id: true },
      }),
    ]);

    const globalBatchId = latestGlobal?.batch_id ?? null;
    const siteIds = installs.map((i) => i.comp_site_id);

    // Query 2: all stage history rows for the global batch (one query, not N per site)
    // Query 3: latest COMMENT per install (one query, not N per site)
    const [allBatchEntries, allComments] = await Promise.all([
      globalBatchId
        ? prisma.site_stage_history.findMany({ where: { batch_id: globalBatchId } })
        : Promise.resolve([] as SiteStageRow[]),
      prisma.install_activity.findMany({
        where: { comp_site_id: { in: siteIds }, activity_type: "COMMENT" },
        orderBy: { created_at: "desc" },
        select: { comp_site_id: true, message: true, user_name: true, created_at: true },
      }),
    ]);

    // ── Build lookup maps in memory ───────────────────────────────────────────

    // Group batch entries by comp_site_id
    // Sites absent from the global batch will get an empty array → { OB: null, PPE: null }
    const entriesBySite = new Map<string, SiteStageRow[]>();
    for (const e of allBatchEntries) {
      if (!entriesBySite.has(e.comp_site_id)) entriesBySite.set(e.comp_site_id, []);
      entriesBySite.get(e.comp_site_id)!.push(e);
    }

    // Keep only the first (latest) comment per site
    const latestCommentMap = new Map<string, typeof allComments[0]>();
    for (const c of allComments) {
      if (!latestCommentMap.has(c.comp_site_id)) latestCommentMap.set(c.comp_site_id, c);
    }

    // ── Enrich installs synchronously (no more async per-install) ─────────────
    const enriched = installs.map((install) => ({
      ...install,
      // Sites not in the global batch get { OB: null, PPE: null } — not stale old data
      pipeline_state: buildPipelineState(entriesBySite.get(install.comp_site_id) ?? []),
      latest_comment: latestCommentMap.get(install.comp_site_id) ?? null,
    }));

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
        pipeline_state: await getPipelineStateForSite(trimmedId),
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
