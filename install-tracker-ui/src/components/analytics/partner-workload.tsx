/**
 * Partner Workload Trend — Line chart showing tasks/frames over time per partner+type combo.
 *
 * Data source: stage_snapshots (aggregate partner-level data).
 * Excludes "Protex Review" stage — only Annotate & Review count as partner workload.
 *
 * HOW TO MODIFY:
 * - To include Protex Review, remove the `.filter((s) => s.stage_name !== "Protex Review")` in the filtered useMemo.
 * - To add a new metric toggle, add it to the metric state and update chartData aggregation.
 * - COLOR_PALETTE assigns colors by index — add more colors if you have 12+ partner combos.
 */

"use client";

import { useState, useMemo } from "react";
import { StageSnapshot, PipelineType } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* Larger palette: each partner+type combo gets a unique color */
const COLOR_PALETTE = [
  "#6366f1", "#0891b2", "#c026d3", "#f59e0b",
  "#22c55e", "#ef4444", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f97316", "#3b82f6", "#a855f7",
];

function getColor(index: number) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

interface PartnerWorkloadProps {
  snapshots: StageSnapshot[];
}

export function PartnerWorkload({ snapshots }: PartnerWorkloadProps) {
  const [metric, setMetric] = useState<"tasks" | "frames">("tasks");
  const [selectedPartner, setSelectedPartner] = useState("All");
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineType | "All">("All");

  /* Derive unique partners and partner+type combos from data */
  const partners = useMemo(
    () => [...new Set(snapshots.map((s) => s.partner))].sort(),
    [snapshots],
  );

  /* Filter snapshots by selected partner & pipeline; exclude Protex Review (only Annotate & Review matter for workload) */
  const filtered = useMemo(() => {
    let data = snapshots.filter((s) => s.stage_name !== "Protex Review");
    if (selectedPartner !== "All") data = data.filter((s) => s.partner === selectedPartner);
    if (selectedPipeline !== "All") data = data.filter((s) => s.pipeline_type === selectedPipeline);
    return data;
  }, [snapshots, selectedPartner, selectedPipeline]);

  /* Build series keys: "Partner (Type)" for each distinct combo in the filtered set */
  const seriesKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of filtered) keys.add(`${s.partner} (${s.pipeline_type})`);
    return [...keys].sort();
  }, [filtered]);

  /* Assign stable colors */
  const colorMap = useMemo(() => {
    const allKeys = [...new Set(snapshots.map((s) => `${s.partner} (${s.pipeline_type})`))].sort();
    const map: Record<string, string> = {};
    allKeys.forEach((k, i) => { map[k] = getColor(i); });
    return map;
  }, [snapshots]);

  /* Aggregate by date + series key */
  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    for (const s of filtered) {
      const key = `${s.partner} (${s.pipeline_type})`;
      const existing = dateMap.get(s.batch_date) || {};
      existing[key] = (existing[key] || 0) + s[metric];
      dateMap.set(s.batch_date, existing);
    }
    return Array.from(dateMap.keys())
      .sort()
      .map((date) => ({ date: date.slice(5), ...dateMap.get(date) }));
  }, [filtered, metric]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <CardTitle>Partner Workload Trend</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Partner filter */}
          <select
            value={selectedPartner}
            onChange={(e) => setSelectedPartner(e.target.value)}
            className="bg-[rgba(255,255,255,0.04)] border border-border rounded-full text-xs font-bold text-text-secondary px-3 py-1.5 outline-none cursor-pointer"
          >
            <option value="All" className="bg-card">All Partners</option>
            {partners.map((p) => (
              <option key={p} value={p} className="bg-card">{p}</option>
            ))}
          </select>

          {/* Pipeline type filter */}
          <div className="flex gap-1 bg-[rgba(255,255,255,0.04)] rounded-full p-0.5">
            {(["All", "OB", "PPE"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPipeline(p)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  selectedPipeline === p ? "bg-sky-500 text-white" : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Metric toggle */}
          <div className="flex gap-1 bg-[rgba(255,255,255,0.04)] rounded-full p-0.5">
            {(["tasks", "frames"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  metric === m ? "bg-sky-500 text-white" : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-text-tertiary text-sm">
          No snapshot data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.35)" fontSize={11} label={{ value: "Date", position: "insideBottom", offset: -2, style: { fill: "rgba(255,255,255,0.4)", fontSize: 10 } }} />
            <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} label={{ value: metric === "tasks" ? "Tasks" : "Frames", angle: -90, position: "insideLeft", offset: 10, style: { fill: "rgba(255,255,255,0.4)", fontSize: 10 } }} />
            <Tooltip
              contentStyle={{
                background: "#102844",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {seriesKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colorMap[key] || "#ffffff"}
                strokeWidth={2}
                dot={{ r: 2.5, fill: colorMap[key] || "#ffffff" }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
