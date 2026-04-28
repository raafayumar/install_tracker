"use client";

import { useState } from "react";
import { InstallActivity } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, AlertTriangle, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface CommentsSectionProps {
  comments: InstallActivity[];
  currentUser: string;
  onAddComment?: (message: string) => void;
  isPosting?: boolean;
  postError?: string | null;
  isLoading?: boolean;
  isError?: boolean;
}

export function CommentsSection({
  comments,
  currentUser,
  onAddComment,
  isPosting,
  postError,
  isLoading,
  isError,
}: CommentsSectionProps) {
  const [newComment, setNewComment] = useState("");

  const handleSubmit = () => {
    if (!newComment.trim() || !onAddComment) return;
    onAddComment(newComment.trim());
    setNewComment("");
  };

  return (
    <Card>
      <CardTitle className="flex items-center gap-2">
        <MessageSquare size={16} className="text-sky-500" />
        Comments
        <span className="text-text-tertiary font-medium text-sm ml-1">({comments.length})</span>
      </CardTitle>

      {/* Add Comment */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center text-[10px] font-bold text-sky-500">
            {currentUser?.[0] || "?"}
          </div>
          <span className="text-xs font-semibold text-text-secondary">Posting as {currentUser}</span>
        </div>
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[80px]"
        />
        {postError && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle size={12} />
            {postError}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} size="sm" disabled={!newComment.trim() || isPosting}>
            {isPosting ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
            {isPosting ? "Posting..." : "Post Comment"}
          </Button>
        </div>
      </div>

      {/* Comments List */}
      <div className="mt-4 flex flex-col gap-3">
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-text-tertiary text-sm">
            <RefreshCw size={14} className="animate-spin mr-2" />
            Loading comments...
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 text-sm text-red-400 py-4 justify-center">
            <AlertTriangle size={14} />
            Failed to load comments
          </div>
        )}
        {!isLoading && !isError && comments.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-4">No comments yet</p>
        )}
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="bg-[rgba(255,255,255,0.02)] border border-border rounded-[8px] p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center text-[10px] font-bold text-sky-500">
                  {comment.user_name?.[0] || "?"}
                </div>
                <span className="text-sm font-bold text-text-primary">{comment.user_name}</span>
              </div>
              <span className="text-[10px] text-text-tertiary">{formatDateTime(comment.created_at)}</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{comment.message}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
