/**
 * React Query hooks for install CRUD, comments, activity, and user management.
 *
 * HOW TO MODIFY:
 * - To add a new API call: create a new useQuery/useMutation hook following the pattern.
 * - To change cache invalidation: edit the onSuccess callbacks.
 * - queryKey arrays determine when React Query refetches. Adding a filter param
 *   to the key means changing that filter triggers a refetch.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Install, InstallActivity } from "@/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  return res.json();
}

export function useInstalls(filters: {
  owner?: string;
  status?: string;
  region?: string;
  type?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters.owner && filters.owner !== "All") params.set("owner", filters.owner);
  if (filters.status && filters.status !== "All") params.set("status", filters.status);
  if (filters.region && filters.region !== "All") params.set("region", filters.region);
  if (filters.type && filters.type !== "All") params.set("type", filters.type);
  if (filters.search) params.set("search", filters.search);

  return useQuery<Install[]>({
    queryKey: ["installs", filters],
    queryFn: () => fetchJson(`/api/installs?${params.toString()}`),
  });
}

export function useInstall(id: string) {
  return useQuery<Install>({
    queryKey: ["install", id],
    queryFn: () => fetchJson(`/api/installs/${id}`),
    enabled: !!id,
  });
}

export function useCreateInstall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/installs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Failed to create install (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["installs"] }),
  });
}

export function useUpdateInstall(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/installs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update install");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["install", id] });
      qc.invalidateQueries({ queryKey: ["installs"] });
    },
  });
}

export function useComments(id: string) {
  return useQuery<InstallActivity[]>({
    queryKey: ["comments", id],
    queryFn: () => fetchJson(`/api/installs/${id}/comments`),
    enabled: !!id,
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { message: string; user_name: string }) => {
      const res = await fetch(`/api/installs/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", id] });
      qc.invalidateQueries({ queryKey: ["activity", id] });
    },
  });
}

export function useActivity(id: string) {
  return useQuery<InstallActivity[]>({
    queryKey: ["activity", id],
    queryFn: () => fetchJson(`/api/installs/${id}/activity`),
    enabled: !!id,
  });
}

export function useStageHistory(id: string, pipeline?: string) {
  const params = pipeline && pipeline !== "All" ? `?pipeline=${pipeline}` : "";
  return useQuery({
    queryKey: ["stage-history", id, pipeline],
    queryFn: () => fetchJson(`/api/installs/${id}/stage-history${params}`),
    enabled: !!id,
  });
}

export function useUsers() {
  return useQuery<{ name: string }[]>({
    queryKey: ["users"],
    queryFn: () => fetchJson("/api/users"),
  });
}
