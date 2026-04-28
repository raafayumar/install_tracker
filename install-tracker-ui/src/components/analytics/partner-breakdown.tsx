"use client";

import { StageSnapshot } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const STAGE_COLORS: Record<string, string> = {
  Annotate: "#00a0f2",
  Review: "#f5a623",
  "Protex Review": "#22c55e",
};

interface PartnerBreakdownProps {
  snapshots: StageSnapshot[];
}

export function PartnerBreakdown({ snapshots }: PartnerBreakdownProps) {
  // Latest batch only
  const batchDates = [...new Set(snapshots.map((s) => s.batch_date))].sort();
  const latestDate = batchDates[batchDates.length - 1];
  const latest = snapshots.filter((s) => s.batch_date === latestDate);

  // Group by partner + stage
  const partnerMap = new Map<string, Record<string, number>>();
  for (const s of latest) {
    const existing = partnerMap.get(s.partner) || {};
    existing[s.stage_name] = (existing[s.stage_name] || 0) + s.tasks;
    partnerMap.set(s.partner, existing);
  }

  const chartData = Array.from(partnerMap.entries()).map(([partner, stages]) => ({
    partner,
    ...stages,
  }));

  const stageNames = ["Annotate", "Review", "Protex Review"];

  return (
    <Card>
      <CardTitle>Current Partner x Stage Breakdown</CardTitle>
      <p className="text-xs text-text-tertiary mb-4">Latest batch: {latestDate || "—"}</p>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="partner" stroke="rgba(255,255,255,0.35)" fontSize={11} label={{ value: "Partner", position: "insideBottom", offset: -2, style: { fill: "rgba(255,255,255,0.4)", fontSize: 10 } }} />
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
              fill={STAGE_COLORS[stage]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
