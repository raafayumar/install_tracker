"use client";

import { useState } from "react";
import { InstallActivity, ActivityType } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { Activity, ChevronDown, ChevronUp, MessageSquare, RefreshCw, FileText, Zap } from "lucide-react";

const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ReactNode; color: string; label: string }> = {
  STAGE_UPDATE: { icon: <Zap size={12} />, color: "#00a0f2", label: "Stage Update" },
  COMMENT: { icon: <MessageSquare size={12} />, color: "#22c55e", label: "Comment" },
  SUMMARY: { icon: <FileText size={12} />, color: "#f5a623", label: "Summary" },
  PARSER_UPDATE: { icon: <RefreshCw size={12} />, color: "#6366f1", label: "Parser Update" },
};

interface ActivityLogProps {
  activities: InstallActivity[];
}

export function ActivityLog({ activities }: ActivityLogProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <CardTitle className="flex items-center gap-2 mb-0">
          <Activity size={16} className="text-sky-500" />
          Activity Log
          <span className="text-text-tertiary font-medium text-sm">({activities.length})</span>
        </CardTitle>
        {expanded ? <ChevronUp size={16} className="text-text-tertiary" /> : <ChevronDown size={16} className="text-text-tertiary" />}
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col">
          {activities.map((activity, idx) => {
            const config = ACTIVITY_CONFIG[activity.activity_type];
            return (
              <div key={activity.id} className="flex gap-3 pb-4 relative">
                {/* Timeline line */}
                {idx < activities.length - 1 && (
                  <div className="absolute left-[11px] top-7 bottom-0 w-[1px] bg-border" />
                )}
                {/* Icon */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${config.color}18`, color: config.color }}
                >
                  {config.icon}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: `${config.color}15`, color: config.color }}
                    >
                      {config.label}
                    </span>
                    <span className="text-text-tertiary text-[10px]">{activity.user_name}</span>
                    <span className="text-text-tertiary text-[10px]">{formatDateTime(activity.created_at)}</span>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">{activity.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
