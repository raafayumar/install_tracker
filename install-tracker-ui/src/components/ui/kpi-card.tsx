"use client";

import { Card } from "./card";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  accentColor?: string;
}

export function KpiCard({ label, value, icon, trend, accentColor = "#00a0f2" }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="section-label">{label}</span>
          <span className="text-3xl font-extrabold text-text-primary tracking-tight">{value}</span>
          {trend && (
            <span
              className="text-xs font-bold"
              style={{ color: trend.value >= 0 ? "#22c55e" : "#f05252" }}
            >
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </span>
          )}
        </div>
        <div
          className="flex items-center justify-center w-10 h-10 rounded-[8px]"
          style={{ background: `${accentColor}18` }}
        >
          <div style={{ color: accentColor }}>{icon}</div>
        </div>
      </div>
      {/* Decorative gradient bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
      />
    </Card>
  );
}
