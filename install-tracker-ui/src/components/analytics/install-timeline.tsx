"use client";

import { useMemo } from "react";
import { Install } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "In-progress": { bg: "rgba(0, 160, 242, 0.25)", border: "#00a0f2", text: "#7dd3fc" },
  Complete: { bg: "rgba(34, 197, 94, 0.25)", border: "#22c55e", text: "#86efac" },
  "On Hold": { bg: "rgba(245, 166, 35, 0.25)", border: "#f5a623", text: "#fcd34d" },
  Cancelled: { bg: "rgba(240, 82, 82, 0.25)", border: "#f05252", text: "#fca5a5" },
};

interface InstallTimelineProps {
  installs: Install[];
}

export function InstallTimeline({ installs }: InstallTimelineProps) {
  const timeline = useMemo(() => {
    const now = new Date();

    // Only installs with a start_date
    const withDates = installs
      .filter((i) => i.start_date)
      .map((i) => {
        const start = new Date(i.start_date);
        const end = i.end_date ? new Date(i.end_date) : now;
        const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        return { ...i, startDate: start, endDate: end, days };
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    if (withDates.length === 0) return { items: [], minDate: now, maxDate: now, totalSpan: 1 };

    const minDate = withDates[0].startDate;
    const maxDate = new Date(Math.max(...withDates.map((i) => i.endDate.getTime())));
    const totalSpan = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

    return { items: withDates, minDate, maxDate, totalSpan };
  }, [installs]);

  if (timeline.items.length === 0) {
    return (
      <Card>
        <CardTitle>Install Timeline</CardTitle>
        <div className="flex items-center justify-center py-12 text-text-tertiary text-sm">
          No installs with date data
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Install Timeline</CardTitle>
      <p className="text-xs text-text-tertiary mb-4">
        Duration of each install from start to {"{"}completion / now{"}"}
      </p>

      <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-2">
        {timeline.items.map((item) => {
          const offsetPct = ((item.startDate.getTime() - timeline.minDate.getTime()) / (1000 * 60 * 60 * 24)) / timeline.totalSpan * 100;
          const widthPct = Math.max(2, (item.days / timeline.totalSpan) * 100);
          const colors = STATUS_COLORS[item.status] || STATUS_COLORS["In-progress"];

          return (
            <div key={item.comp_site_id} className="flex items-center gap-2 group">
              {/* Label */}
              <div className="w-40 shrink-0 text-right">
                <div className="text-[11px] text-text-primary font-semibold truncate" title={item.site_name}>
                  {item.site_name}
                </div>
                <div className="text-[9px] text-text-tertiary truncate">{item.comp_site_id}</div>
              </div>

              {/* Bar track */}
              <div className="flex-1 h-7 relative rounded-[4px] bg-[rgba(255,255,255,0.02)]">
                <div
                  className="absolute top-0 h-full rounded-[4px] flex items-center px-2 transition-all"
                  style={{
                    left: `${offsetPct}%`,
                    width: `${widthPct}%`,
                    background: colors.bg,
                    borderLeft: `2px solid ${colors.border}`,
                    minWidth: "40px",
                  }}
                  title={`${item.site_name}\nStatus: ${item.status}\nDays: ${item.days}\n${item.start_date} → ${item.end_date || "ongoing"}`}
                >
                  <span className="text-[9px] font-bold whitespace-nowrap" style={{ color: colors.text }}>
                    {item.days}d — {item.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-4 mt-4 text-[10px] text-text-tertiary">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-[2px]" style={{ background: colors.bg, border: `1px solid ${colors.border}` }} />
            {status}
          </div>
        ))}
      </div>
    </Card>
  );
}
