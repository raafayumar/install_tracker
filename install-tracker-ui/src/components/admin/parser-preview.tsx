"use client";

import { ParsedBlock } from "@/types";
import { Card } from "@/components/ui/card";
import { PipelineBadge, PartnerBadge, StageBadge } from "@/components/ui/badge";

interface ParserPreviewProps {
  blocks: ParsedBlock[];
}

export function ParserPreview({ blocks }: ParserPreviewProps) {
  if (blocks.length === 0) {
    return (
      <div className="text-text-tertiary text-sm text-center py-8">
        No partner blocks parsed. Check the message format.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="section-label">Parsed Blocks ({blocks.length})</span>
      {blocks.map((block, idx) => (
        <Card key={idx} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <PipelineBadge type={block.pipeline_type} />
            <PartnerBadge partner={block.partner} />
          </div>

          {block.stages.length === 0 ? (
            <p className="text-text-tertiary text-sm">No stages found</p>
          ) : (
            <div className="flex flex-col gap-2">
              {block.stages.map((stage, sIdx) => (
                <div key={sIdx} className="flex items-start gap-3 py-2 border-b border-dashed border-border last:border-0">
                  <StageBadge stage={stage.stage_name} tasks={stage.tasks} />
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="text-text-secondary">{stage.frames} frames</span>
                    {stage.datasets.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {stage.datasets.map((ds) => (
                          <span key={ds} className="px-1.5 py-0.5 bg-[rgba(255,255,255,0.04)] rounded text-text-tertiary text-[10px] font-medium">
                            {ds}
                            {stage.dataset_tasks[ds] !== undefined && (
                              <span className="ml-1 text-sky-500">({stage.dataset_tasks[ds]})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
