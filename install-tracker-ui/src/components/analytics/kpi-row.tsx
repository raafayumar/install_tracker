"use client";

import { KpiData } from "@/types";
import { KpiCard } from "@/components/ui/kpi-card";
import { Monitor, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface KpiRowProps {
  data: KpiData;
}

export function KpiRow({ data }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Active Installs"
        value={data.activeInstalls}
        icon={<Monitor size={20} strokeWidth={1.75} />}
        accentColor="#00a0f2"
      />
      <KpiCard
        label="Completed"
        value={data.completed}
        icon={<CheckCircle size={20} strokeWidth={1.75} />}
        accentColor="#22c55e"
      />
      <KpiCard
        label="Avg Days to Complete"
        value={data.avgDaysToComplete}
        icon={<Clock size={20} strokeWidth={1.75} />}
        accentColor="#f5a623"
      />
      <KpiCard
        label="No-Data Installs"
        value={data.noDataCount}
        icon={<AlertTriangle size={20} strokeWidth={1.75} />}
        accentColor="#f05252"
      />
    </div>
  );
}
