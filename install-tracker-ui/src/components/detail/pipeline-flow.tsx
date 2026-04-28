/**
 * PipelineFlow — Visual pipeline stage flow (Annotate → Review → Protex Review).
 *
 * Now accepts StageEntry[] (from site_stage_history) instead of PipelineStage[].
 * Shows frames count per stage (tasks no longer stored separately).
 */

"use client";

import { StageEntry, StageName } from "@/types";
import { STAGE_COLORS } from "@/lib/utils";

/** The fixed order of pipeline stages */
const FLOW_STAGES: StageName[] = ["Annotate", "Review", "Protex Review"];

interface PipelineFlowProps {
  stages: StageEntry[];
}

export function PipelineFlow({ stages }: PipelineFlowProps) {
  // Map stage_name → StageEntry for quick lookup
  const stageMap = new Map(stages.map((s) => [s.stage_name, s]));

  return (
    <div className="flex items-center gap-0 w-full py-4">
      {FLOW_STAGES.map((stageName, idx) => {
        const entry = stageMap.get(stageName);
        const isActive = !!entry;
        const colors = STAGE_COLORS[stageName];

        return (
          <div key={stageName} className="flex items-center flex-1">
            {/* Node */}
            <div className="flex flex-col items-center gap-2 flex-1">
              {/* Circle indicator */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-250 ${
                  isActive ? "shadow-[var(--shadow-glow)]" : "opacity-30"
                }`}
                style={{
                  background: isActive ? colors.text : "rgba(255,255,255,0.06)",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.35)",
                  border: isActive ? "none" : "1.5px dashed rgba(255,255,255,0.15)",
                }}
              >
                {idx + 1}
              </div>

              {/* Stage label */}
              <span className={`text-xs font-bold text-center ${isActive ? "text-text-primary" : "text-text-tertiary"}`}>
                {stageName}
              </span>

              {/* Frame count (replaces old tasks/frames display) */}
              {entry && (
                <div className="flex flex-col items-center">
                  <span className="text-lg font-extrabold" style={{ color: colors.text }}>
                    {entry.frames != null ? entry.frames : "—"}
                  </span>
                  <span className="text-[10px] text-text-tertiary font-medium">frames</span>
                </div>
              )}
            </div>

            {/* Connector line between stages */}
            {idx < FLOW_STAGES.length - 1 && (
              <div
                className="h-[2px] flex-1 min-w-[24px] mt-[-44px]"
                style={{ borderTop: "2px dashed rgba(0, 160, 242, 0.3)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
