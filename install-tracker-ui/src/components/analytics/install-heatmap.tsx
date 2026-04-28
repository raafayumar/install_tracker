/**
 * Install Data Presence Heatmap — Shows which stages have data for a selected install over time.
 *
 * Data source: site_stage_history (per-site rows). Renders a grid with dates as columns
 * and stages as rows. Green cells = data present, with frame count and partner on hover.
 *
 * HOW TO MODIFY:
 * - Partners are derived from site_stage_history (handles multiple partners natively).
 * - To add more info to the hover tooltip, edit the `title` prop on the cell div.
 * - The install dropdown shows "comp_site_id — site_name" for each install.
 */

"use client";

import { useState, useMemo } from "react";
import { SiteStageHistory, PipelineType, Install } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";

interface InstallHeatmapProps {
  siteHistory: SiteStageHistory[];
  installs: Install[];
}

export function InstallHeatmap({ siteHistory, installs }: InstallHeatmapProps) {
  const [selectedId, setSelectedId] = useState(installs[0]?.comp_site_id || "");
  const [pipeline, setPipeline] = useState<PipelineType | "All">("All");

  /* Build a lookup for install details */
  const installMap = useMemo(() => {
    const map = new Map<string, Install>();
    for (const inst of installs) map.set(inst.comp_site_id, inst);
    return map;
  }, [installs]);

  const selectedInstall = installMap.get(selectedId);

  /* Get ALL partners for this install from site_stage_history */
  const installPartners = useMemo(() => {
    const siteData = siteHistory.filter((h) => h.comp_site_id === selectedId);
    const typePartners = new Map<string, Set<string>>();
    for (const h of siteData) {
      if (!typePartners.has(h.pipeline_type)) typePartners.set(h.pipeline_type, new Set());
      typePartners.get(h.pipeline_type)!.add(h.partner);
    }
    // Fall back to pipeline_state if no history rows
    if (typePartners.size === 0 && selectedInstall?.pipeline_state) {
      const ps = selectedInstall.pipeline_state;
      if (ps.OB) typePartners.set("OB", new Set(ps.OB.partners));
      if (ps.PPE) typePartners.set("PPE", new Set(ps.PPE.partners));
    }
    return [...typePartners.entries()].map(([type, partners]) => [type, [...partners].sort()] as [string, string[]]);
  }, [siteHistory, selectedId, selectedInstall]);

  const filtered = useMemo(() => {
    let data = siteHistory.filter((h) => h.comp_site_id === selectedId);
    if (pipeline !== "All") data = data.filter((h) => h.pipeline_type === pipeline);
    return data;
  }, [siteHistory, selectedId, pipeline]);

  // Build heatmap grid
  const dates = [...new Set(filtered.map((h) => h.batch_date))].sort();
  const stages = ["Annotate", "Review", "Protex Review"];

  // Create presence + partner map
  const presenceMap = new Map<string, { present: boolean; partner: string; frames: number | null }>();
  for (const h of filtered) {
    presenceMap.set(`${h.batch_date}-${h.stage_name}`, {
      present: true,
      partner: h.partner,
      frames: h.frames,
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <CardTitle>Install Data Presence Timeline</CardTitle>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-card border border-border rounded-full text-xs font-bold text-text-secondary px-3 py-1.5 outline-none cursor-pointer max-w-[280px]"
          >
            {installs.map((inst) => (
              <option key={inst.comp_site_id} value={inst.comp_site_id} className="bg-card">
                {inst.comp_site_id} — {inst.site_name}
              </option>
            ))}
          </select>
          <div className="flex gap-1 bg-[rgba(255,255,255,0.04)] rounded-full p-0.5">
            {(["All", "OB", "PPE"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPipeline(p)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  pipeline === p ? "bg-sky-500 text-white" : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Install info bar */}
      {selectedInstall && (
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary">Site:</span>
            <span className="text-text-primary font-semibold">{selectedInstall.site_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary">Company ID:</span>
            <span className="text-text-primary font-semibold">{selectedInstall.comp_site_id}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary">Owner:</span>
            <span className="text-text-primary font-semibold">{selectedInstall.owner_name}</span>
          </div>
          {installPartners.map(([type, partners]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="text-text-tertiary">{type} Partner{partners.length > 1 ? "s" : ""}:</span>
              <span className="text-sky-400 font-semibold">{partners.join(", ")}</span>
            </div>
          ))}
        </div>
      )}

      {dates.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-text-tertiary text-sm">
          No history data for this install
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-fit">
            {/* Header row - dates */}
            <div className="flex items-center gap-1 mb-2">
              <div className="w-28 shrink-0" />
              {dates.map((date) => (
                <div key={date} className="w-14 text-center text-[9px] text-text-tertiary font-medium">
                  {date.slice(5)}
                </div>
              ))}
            </div>

            {/* Stage rows */}
            {stages.map((stage) => (
              <div key={stage} className="flex items-center gap-1 mb-1">
                <div className="w-28 shrink-0 text-xs text-text-secondary font-semibold truncate">
                  {stage}
                </div>
                {dates.map((date) => {
                  const entry = presenceMap.get(`${date}-${stage}`);
                  const present = !!entry?.present;
                  return (
                    <div
                      key={`${date}-${stage}`}
                      className="w-14 h-8 rounded-[4px] transition-colors flex items-center justify-center"
                      style={{
                        background: present ? "rgba(34, 197, 94, 0.6)" : "rgba(255, 255, 255, 0.03)",
                        border: present ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(255,255,255,0.05)",
                      }}
                      title={
                        present
                          ? `${stage} — ${date}\nPartner: ${entry!.partner}\nFrames: ${entry!.frames ?? "—"}`
                          : `${stage} — ${date}: Absent`
                      }
                    >
                      {present && entry!.frames != null && (
                        <span className="text-[9px] text-green-200 font-bold">{entry!.frames}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-[10px] text-text-tertiary">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[2px]" style={{ background: "rgba(34, 197, 94, 0.6)" }} />
                Present (hover for partner & frames)
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[2px]" style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255,255,255,0.05)" }} />
                Absent
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
