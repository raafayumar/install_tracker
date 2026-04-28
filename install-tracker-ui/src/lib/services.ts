/**
 * Business logic for processing Slack parser results.
 *
 * SIMPLIFIED ARCHITECTURE (v2):
 * The parser only writes to two tables:
 *   1. site_stage_history — per-site, per-partner, per-stage records (source of truth)
 *   2. stage_snapshots    — pre-aggregated partner-level metrics (for analytics)
 *
 * There are NO "pipelines" or "pipeline_stages" tables anymore.
 * The "current state" of a site is simply the latest batch in site_stage_history.
 */

import { prisma } from "./prisma";
import { ParsedBlock } from "@/types";
import { pipelinetype, activitytype } from "@prisma/client";

/** Convert string "OB"/"PPE" to the Prisma enum */
function toPipelineType(val: string): pipelinetype {
  return val === "PPE" ? pipelinetype.PPE : pipelinetype.OB;
}

/**
 * Apply parsed Slack message output to the database.
 *
 * Steps:
 *   1. For each partner block → save aggregate snapshot + per-site history rows
 *   2. Log activity for each touched install
 *   3. Clean up old data (>30 days)
 */
export async function processParserResults(parsedBlocks: ParsedBlock[]) {
  const now = new Date();
  const batchId = now.toISOString().replace(/\.\d{3}Z$/, "Z");

  const stats = {
    installs_touched: new Set<string>(),
    records_created: 0,
    errors: [] as string[],
  };

  await prisma.$transaction(async (tx) => {
    for (const block of parsedBlocks) {
      const partner = block.partner;
      const pType = toPipelineType(block.pipeline_type);

      for (const stageInfo of block.stages) {
        // ── Step 1a: Save aggregate StageSnapshot (for analytics) ──
        await tx.stage_snapshots.create({
          data: {
            batch_id: batchId,
            partner,
            pipeline_type: pType,
            stage_name: stageInfo.stage_name,
            tasks: stageInfo.tasks,
            frames: stageInfo.frames,
            datasets: stageInfo.datasets,
            created_at: now,
          },
        });

        // ── Step 1b: Save per-site history rows ──
        for (const ds of stageInfo.datasets) {
          try {
            const cid = ds.trim();

            // Ensure install record exists (parser creates skeleton if new)
            await tx.installs.upsert({
              where: { comp_site_id: cid },
              create: { comp_site_id: cid },
              update: {},
            });

            // Write the per-site history row — this IS the pipeline state
            const perSiteFrames = stageInfo.dataset_tasks[ds] ?? null;
            await tx.site_stage_history.create({
              data: {
                batch_id: batchId,
                comp_site_id: cid,
                partner,
                pipeline_type: pType,
                stage_name: stageInfo.stage_name,
                frames: perSiteFrames,
                created_at: now,
              },
            });

            stats.records_created++;
            stats.installs_touched.add(cid);
          } catch (err) {
            stats.errors.push(`${ds}: ${err}`);
          }
        }
      }
    }

    // ── Step 2: Log activity for each touched install ──
    for (const cid of stats.installs_touched) {
      await tx.install_activity.create({
        data: {
          comp_site_id: cid,
          activity_type: activitytype.PARSER_UPDATE,
          user_name: "system",
          message: `Slack parser update — ${stats.records_created} history records created`,
          metadata: {
            partners: parsedBlocks.map((b) => b.partner),
            batch_id: batchId,
          },
          created_at: now,
        },
      });
    }

    // ── Step 3: Clean up old data (>30 days) ──
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await tx.stage_snapshots.deleteMany({ where: { created_at: { lt: cutoff } } });
    await tx.site_stage_history.deleteMany({ where: { created_at: { lt: cutoff } } });
  }, { timeout: 30000 });

  return {
    installs_touched: [...stats.installs_touched],
    records_created: stats.records_created,
    errors: stats.errors,
  };
}
