"use client";

import { useState } from "react";
import { ParsedBlock } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ParserPreview } from "./parser-preview";
import { useParserPreview, useParserApply } from "@/hooks/use-parser";
import { Search, CheckCircle, AlertTriangle } from "lucide-react";

export function SlackParser() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedBlock[] | null>(null);

  const parserPreview = useParserPreview();
  const parserApply = useParserApply();

  const handlePreview = () => {
    parserPreview.mutate(text, {
      onSuccess: (blocks) => {
        setPreview(blocks);
        parserApply.reset();
      },
    });
  };

  const handleApply = () => {
    parserApply.mutate(text);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitle>Paste Slack Status Message</CardTitle>
        <p className="text-sm text-text-secondary mb-4">
          Paste the daily pipeline status message from Slack. Both old and new formats are supported.
        </p>
        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview(null); parserApply.reset(); }}
          placeholder="Paste Slack message here..."
          className="min-h-[250px] font-mono text-xs"
        />
        <div className="flex gap-3 mt-4">
          <Button
            onClick={handlePreview}
            variant="secondary"
            disabled={!text.trim() || parserPreview.isPending}
          >
            <Search size={14} />
            {parserPreview.isPending ? "Parsing..." : "Preview Parse"}
          </Button>
          <Button
            onClick={handleApply}
            disabled={!preview || preview.length === 0 || parserApply.isSuccess || parserApply.isPending}
          >
            <CheckCircle size={14} />
            {parserApply.isPending ? "Applying..." : "Apply to Database"}
          </Button>
        </div>
      </Card>

      {/* Applied success */}
      {parserApply.isSuccess && (
        <div className="flex items-center gap-3 bg-[rgba(34,197,94,0.07)] border border-[rgba(34,197,94,0.2)] rounded-[12px] p-4">
          <CheckCircle size={18} className="text-semantic-green shrink-0" />
          <div>
            <p className="text-sm font-bold text-text-primary">Successfully Applied</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {parserApply.data.installs_touched?.length || 0} install(s) touched.{" "}
              {parserApply.data.stages_created || 0} stage record(s) created.
              {parserApply.data.errors?.length > 0 && ` ${parserApply.data.errors.length} error(s).`}
            </p>
          </div>
        </div>
      )}

      {/* Applied error */}
      {parserApply.isError && (
        <div className="flex items-center gap-3 bg-[rgba(240,82,82,0.07)] border border-[rgba(240,82,82,0.2)] rounded-[12px] p-4">
          <AlertTriangle size={18} className="text-semantic-red shrink-0" />
          <div>
            <p className="text-sm font-bold text-text-primary">Apply Failed</p>
            <p className="text-xs text-text-secondary mt-0.5">{parserApply.error.message}</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && !parserApply.isSuccess && <ParserPreview blocks={preview} />}

      {/* Help */}
      <Card muted>
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-semantic-yellow shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary leading-relaxed">
            <p className="font-bold text-text-primary mb-1">Format Guide</p>
            <p>Partners are separated by dashed lines (----). Each partner block starts with the partner name, followed by stages (Annotate, Review, Protex Review) with task and frame counts. Datasets are listed indented below each stage.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
