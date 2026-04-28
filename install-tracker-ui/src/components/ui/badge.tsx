/**
 * Badge components — reusable colored pills for status, region, type, stage, partner, etc.
 *
 * HOW TO MODIFY:
 * - All colors are defined in lib/utils.ts (STATUS_COLORS, STAGE_COLORS, etc.).
 * - To add a new badge type, create a new exported component following the pattern.
 * - BaseBadge is the shared wrapper — all badges use it for consistent styling.
 */

"use client";

import { STATUS_COLORS, REGION_COLORS, TYPE_COLORS, STAGE_COLORS, PIPELINE_COLORS, getPartnerColor } from "@/lib/utils";
import { InstallStatus, Region, InstallType, StageName, PipelineType } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  bg: string;
  textColor: string;
  dot?: boolean;
  dotColor?: string;
  className?: string;
}

function BaseBadge({ children, bg, textColor, dot, dotColor, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${className}`}
      style={{ background: bg, color: textColor, border: `1px solid ${textColor}22` }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: dotColor || textColor }}
        />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: InstallStatus }) {
  const c = STATUS_COLORS[status];
  return <BaseBadge bg={c.bg} textColor={c.text} dot dotColor={c.dot}>{status}</BaseBadge>;
}

export function RegionBadge({ region }: { region: Region }) {
  const c = REGION_COLORS[region];
  return <BaseBadge bg={c.bg} textColor={c.text}>{region}</BaseBadge>;
}

export function TypeBadge({ type }: { type: InstallType }) {
  const c = TYPE_COLORS[type];
  return <BaseBadge bg={c.bg} textColor={c.text}>{type}</BaseBadge>;
}

export function StageBadge({ stage, tasks }: { stage: StageName; tasks?: number | null }) {
  const c = STAGE_COLORS[stage];
  return (
    <BaseBadge bg={c.bg} textColor={c.text}>
      {stage}{tasks != null && <span className="opacity-70"> ({tasks})</span>}
    </BaseBadge>
  );
}

export function PartnerBadge({ partner }: { partner: string }) {
  const c = getPartnerColor(partner);
  return <BaseBadge bg={c.bg} textColor={c.text}>{partner}</BaseBadge>;
}

export function PipelineBadge({ type }: { type: PipelineType }) {
  const c = PIPELINE_COLORS[type];
  return <BaseBadge bg={c.bg} textColor={c.text}>{type}</BaseBadge>;
}

export function NoDataBadge() {
  return (
    <BaseBadge bg="rgba(245, 166, 35, 0.12)" textColor="#f5a623">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      No Data
    </BaseBadge>
  );
}

export function DeployedBadge() {
  return (
    <BaseBadge bg="rgba(34, 197, 94, 0.12)" textColor="#22c55e">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Deployed
    </BaseBadge>
  );
}
