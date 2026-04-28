"use client";

import { Install } from "@/types";
import { Card } from "@/components/ui/card";
import { StatusBadge, RegionBadge, TypeBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ExternalLink, Calendar, User, MapPin } from "lucide-react";

interface InfoHeaderProps {
  install: Install;
}

export function InfoHeader({ install }: InfoHeaderProps) {
  return (
    <Card className="relative overflow-hidden">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-500 to-[#33c6f5]" />

      <div className="flex flex-col gap-4 pt-2">
        {/* Title row */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-text-primary tracking-tight">
                {install.comp_site_id}
              </h2>
              <StatusBadge status={install.status} />
            </div>
            <p className="text-base text-text-secondary font-medium mt-1">
              {install.site_name || "Unnamed Site"}
            </p>
          </div>
          {install.jira_link && (
            <a
              href={install.jira_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(0,160,242,0.08)] text-sky-500 text-xs font-bold hover:bg-[rgba(0,160,242,0.15)] transition-colors"
            >
              <ExternalLink size={12} />
              Jira
            </a>
          )}
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-4">
          <InfoChip icon={<User size={14} />} label="Owner" value={install.owner_name} />
          <InfoChip icon={<MapPin size={14} />} label="Region" value={<RegionBadge region={install.region} />} />
          <div className="flex items-center gap-1.5">
            <TypeBadge type={install.install_type} />
          </div>
          <InfoChip icon={<Calendar size={14} />} label="Started" value={formatDate(install.start_date)} />
          {install.end_date && (
            <InfoChip icon={<Calendar size={14} />} label="Completed" value={formatDate(install.end_date)} />
          )}
        </div>
      </div>
    </Card>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-sky-500">{icon}</span>
      <span className="text-text-tertiary font-medium">{label}:</span>
      <span className="text-text-primary font-semibold">{typeof value === "string" ? value : value}</span>
    </div>
  );
}
