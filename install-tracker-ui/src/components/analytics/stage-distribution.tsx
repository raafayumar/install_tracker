/**
 * Stage Distribution Over Time — Stacked bar chart showing Annotate/Review/Protex Review task counts.
 *
 * Data source: stage_snapshots. Supports filtering by partner, partner+type combo, and pipeline type.
 *
 * HOW TO MODIFY:
 * - To add a new stage, add it to the `stageNames` array and STAGE_BAR_COLORS map.
 * - The partner dropdown supports both "Sunix_v2" (all pipelines) and "Sunix_v2 (PPE)" (specific combo).
 */

"use client";

import { useState, useMemo } from "react";
import { StageSnapshot, PipelineType } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const STAGE_BAR_COLORS: Record<string, string> = {
  Annotate: "#00a0f2",
  Review: "#f5a623",
  "Protex Review": "#22c55e",
};

interface StageDistributionProps {
  snapshots: StageSnapshot[];
}

export function StageDistribution({ snapshots }: StageDistributionProps) {
  const [pipeline, setPipeline] = useState<PipelineType | "All">("All");
  const [selectedPartner, setSelectedPartner] = useState("All");

  const partners = useMemo(
    () => [...new Set(snapshots.map((s) => s.partner))].sort(),
    [snapshots],
  );

  /* Derive unique partner+type combos for the combo filter */
  const partnerTypeCombos = useMemo(() => {
    const combos = new Set<string>();
    for (const s of snapshots) combos.add(`${s.partner} (${s.pipeline_type})`);
    return [...combos].sort();
  }, [snapshots]);

  const filtered = useMemo(() => {
    let data = snapshots;
    if (pipeline !== "All") data = data.filter((s) => s.pipeline_type === pipeline);
    if (selectedPartner !== "All") {
      // Check if it's a "Partner (Type)" combo or just a partner name
      const comboMatch = selectedPartner.match(/^(.+) \((OB|PPE)\)$/);
      if (comboMatch) {
        data = data.filter((s) => s.partner === comboMatch[1] && s.pipeline_type === comboMatch[2]);
      } else {
        data = data.filter((s) => s.partner === selectedPartner);
      }
    }
    return data;
  }, [snapshots, pipeline, selectedPartner]);

  // Aggregate by date + stage
  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    for (const s of filtered) {
      const existing = dateMap.get(s.batch_date) || {};
      existing[s.stage_name] = (existing[s.stage_name] || 0) + s.tasks;
      dateMap.set(s.batch_date, existing);
    }
    return Array.from(dateMap.keys())
      .sort()
      .map((date) => ({ date: date.slice(5), ...dateMap.get(date) }));
  }, [filtered]);

  const stageNames = ["Annotate", "Review", "Protex Review"];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <CardTitle>Stage Distribution Over Time</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Partner + type filter */}
          <select
            value={selectedPartner}
            onChange={(e) => setSelectedPartner(e.target.value)}
            className="bg-[rgba(255,255,255,0.04)] border border-border rounded-full text-xs font-bold text-text-secondary px-3 py-1.5 outline-none cursor-pointer"
          >
            <option value="All" className="bg-card">All Partners</option>
            <optgroup label="Partners">
              {partners.map((p) => (
                <option key={p} value={p} className="bg-card">{p}</option>
              ))}
            </optgroup>
            <optgroup label="Partner + Pipeline">
              {partnerTypeCombos.map((c) => (
                <option key={c} value={c} className="bg-card">{c}</option>
              ))}
            </optgroup>
          </select>

          {/* Pipeline type filter */}
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

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-text-tertiary text-sm">
          No snapshot data for this selection
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.35)" fontSize={11} label={{ value: "Date", position: "insideBottom", offset: -2, style: { fill: "rgba(255,255,255,0.4)", fontSize: 10 } }} />
            <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} label={{ value: "Tasks", angle: -90, position: "insideLeft", offset: 10, style: { fill: "rgba(255,255,255,0.4)", fontSize: 10 } }} />
            <Tooltip
              contentStyle={{
                background: "#102844",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {stageNames.map((stage) => (
              <Bar
                key={stage}
                dataKey={stage}
                stackId="a"
                fill={STAGE_BAR_COLORS[stage]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
