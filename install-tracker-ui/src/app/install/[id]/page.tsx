/**
 * Install detail page — shows full info for a single install.
 *
 * Pipeline cards now receive PipelineTypeState (from pipeline_state)
 * instead of the old Pipeline model.
 */

"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useInstall, useComments, useActivity, useAddComment, useUpdateInstall, useUsers } from "@/hooks/use-installs";
import { InfoHeader } from "@/components/detail/info-header";
import { StatusForm } from "@/components/detail/status-form";
import { PipelineCard } from "@/components/detail/pipeline-card";
import { CommentsSection } from "@/components/detail/comments-section";
import { ActivityLog } from "@/components/detail/activity-log";
import { ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/app/providers";

export default function InstallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { selectedUser } = useAppContext();

  const { data: install, isError, isLoading, error, refetch } = useInstall(id);
  const { data: comments, isLoading: commentsLoading, isError: commentsError } = useComments(id);
  const { data: allActivities } = useActivity(id);
  const { data: users } = useUsers();
  const addComment = useAddComment(id);
  const updateInstall = useUpdateInstall(id);

  const currentUser = selectedUser !== "All" ? selectedUser : (users?.[0]?.name ?? "Unknown");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-text-tertiary">
        <RefreshCw size={18} className="animate-spin mr-2" />
        Loading install details...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <div className="bg-[rgba(240,82,82,0.08)] border border-[rgba(240,82,82,0.3)] rounded-[12px] p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-[8px] bg-[rgba(240,82,82,0.15)] flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <h3 className="text-base font-bold text-text-primary">Unable to load install</h3>
            <p className="text-sm text-text-secondary">
              Could not fetch data for install &quot;{id}&quot;. Please check the database connection.
            </p>
            {error && (
              <pre className="text-xs text-red-400/80 bg-[rgba(0,0,0,0.2)] rounded-[8px] p-3 mt-1 overflow-x-auto">
                {error.message}
              </pre>
            )}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500 text-white text-sm font-bold hover:bg-sky-400 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} />
                Retry
              </button>
              <Button variant="secondary" onClick={() => router.push("/")}>
                <ArrowLeft size={14} />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!install) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-text-tertiary text-lg">Install &quot;{id}&quot; not found</p>
        <Button variant="secondary" onClick={() => router.push("/")}>
          <ArrowLeft size={14} />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Pipeline state is now { OB: PipelineTypeState | null, PPE: ... }
  const obState = install.pipeline_state?.OB ?? null;
  const ppeState = install.pipeline_state?.PPE ?? null;

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-4 py-5 px-8 border-b border-border bg-navy-700/50 backdrop-blur-sm">
        <button
          onClick={() => router.push("/")}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(0,160,242,0.12)] text-text-secondary hover:text-sky-500 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-text-primary tracking-tight">Install Details</h1>
          <p className="text-sky-500 text-sm font-semibold">{install.comp_site_id} — {install.site_name}</p>
        </div>
      </header>

      <div className="p-8 flex flex-col gap-6 max-w-5xl">
        <InfoHeader install={install} />
        <StatusForm
          install={install}
          onSave={(updates) => updateInstall.mutate(updates as Record<string, unknown>)}
        />

        {/* Pipeline cards — now using PipelineTypeState directly */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PipelineCard state={obState} type="OB" />
          <PipelineCard state={ppeState} type="PPE" />
        </div>

        <CommentsSection
          comments={comments ?? []}
          currentUser={currentUser}
          onAddComment={(message) => addComment.mutate({ message, user_name: currentUser })}
          isPosting={addComment.isPending}
          postError={addComment.isError ? (addComment.error?.message || "Failed to post comment") : null}
          isLoading={commentsLoading}
          isError={commentsError}
        />
        <ActivityLog activities={allActivities ?? []} />
      </div>
    </div>
  );
}
