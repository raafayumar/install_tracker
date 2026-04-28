/**
 * Data Volume Trend — Area chart showing total frames/tasks over time (OB vs PPE split or combined).
 *
 * Data source: stage_snapshots. Toggle between OB/PPE split view and combined total,
 * and between frames and tasks metrics.
 *
 * HOW TO MODIFY:
 * - To change colors, edit the PIPELINE_COLORS map.
 * - To add a third pipeline type, add it to the dateMap aggregation + rendering.
 */

"use client";

import { useState, useMemo } from "react";
import { StageSnapshot, PipelineType } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const PIPELINE_COLORS = {
  OB: { stroke: "#6366f1", fill: "rgba(99, 102, 241, 0.15)" },
  PPE: { stroke: "#0891b2", fill: "rgba(8, 145, 178, 0.15)" },
  Total: { stroke: "#22c55e", fill: "rgba(34, 197, 94, 0.1)" },
};

interface DataVolumeTrendProps {
  snapshots: StageSnapshot[];
}

export function DataVolumeTrend({ snapshots }: DataVolumeTrendProps) {
  const [metric, setMetric] = useState<"tasks" | "frames">("frames");
  const [view, setView] = useState<"split" | "total">("split");

  const chartData = useMemo(() => {
    const dateMap = new Map<string, { OB: number; PPE: number }>();

    for (const s of snapshots) {
      const existing = dateMap.get(s.batch_date) || { OB: 0, PPE: 0 };
      if (s.pipeline_type === "OB") existing.OB += s[metric];
      else existing.PPE += s[metric];
      dateMap.set(s.batch_date, existing);
    }

    return Array.from(dateMap.keys())
      .sort()
      .map((date) => {
        const vals = dateMap.get(date)!;
        return {
          date: date.slice(5),
          OB: vals.OB,
          PPE: vals.PPE,
          Total: vals.OB + vals.PPE,
        };
      });
  }, [snapshots, metric]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <CardTitle>Data Volume Trend</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Split / Total toggle */}
          <div className="flex gap-1 bg-[rgba(255,255,255,0.04)] rounded-full p-0.5">
            {(["split", "total"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  view === v ? "bg-sky-500 text-white" : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {v === "split" ? "OB / PPE" : "Total"}
              </button>
            ))}
          </div>

          {/* Metric toggle */}
          <div className="flex gap-1 bg-[rgba(255,255,255,0.04)] rounded-full p-0.5">
            {(["frames", "tasks"] as const).map((m) => (
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
          <AreaChart data={chartData}>
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
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {view === "split" ? (
              <>
                <Area
                  type="monotone"
                  dataKey="OB"
                  stroke={PIPELINE_COLORS.OB.stroke}
                  fill={PIPELINE_COLORS.OB.fill}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="PPE"
                  stroke={PIPELINE_COLORS.PPE.stroke}
                  fill={PIPELINE_COLORS.PPE.fill}
                  strokeWidth={2}
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey="Total"
                stroke={PIPELINE_COLORS.Total.stroke}
                fill={PIPELINE_COLORS.Total.fill}
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
