/**
 * PipelineCard — Detail page component showing a single pipeline type (OB or PPE).
 *
 * Reads from install.pipeline_state (derived from site_stage_history).
 * Handles multiple partners per pipeline type natively.
 */

"use client";

import { PipelineTypeState } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { PipelineBadge, PartnerBadge, NoDataBadge } from "@/components/ui/badge";
import { PipelineFlow } from "./pipeline-flow";

interface PipelineCardProps {
  state: PipelineTypeState | null;
  type: "OB" | "PPE";
}

export function PipelineCard({ state, type }: PipelineCardProps) {
  // No pipeline data at all for this type
  if (!state) {
    return (
      <Card muted className="flex flex-col items-center justify-center py-8">
        <span className="text-text-tertiary text-sm font-medium">No {type} Pipeline</span>
        <span className="text-text-tertiary text-xs mt-1">No data yet</span>
      </Card>
    );
  }

  const hasData = !state.no_data && state.stages.length > 0;

  // Group stages by partner for multi-partner display
  const byPartner = new Map<string, typeof state.stages>();
  for (const s of state.stages) {
    if (!byPartner.has(s.partner)) byPartner.set(s.partner, []);
    byPartner.get(s.partner)!.push(s);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PipelineBadge type={type} />
          <CardTitle className="mb-0">{type === "OB" ? "Object Detection" : "PPE Detection"}</CardTitle>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {state.partners.map((p) => <PartnerBadge key={p} partner={p} />)}
          {!hasData && <NoDataBadge />}
        </div>
      </div>

      {/* Show pipeline flow for each partner */}
      {hasData && [...byPartner.entries()].map(([partner, stages]) => (
        <div key={partner} className="flex flex-col gap-2">
          {byPartner.size > 1 && (
            <span className="text-xs text-text-tertiary font-semibold">{partner}</span>
          )}
          <PipelineFlow stages={stages} />
        </div>
      ))}

      {hasData && state.stages.length === 0 && (
        <div className="text-center py-4 text-text-tertiary text-sm">
          Pipeline complete — no active stages
        </div>
      )}
    </Card>
  );
}
