"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { StatusBadge } from "@/components/batch-calling/StatusBadge";
import type { BatchJob, BatchJobListResponse } from "@/lib/types/batch-calling";

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString();
}

export default function BatchCallingPage() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [nextDoc, setNextDoc] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async (cursor?: string) => {
    try {
      setError(null);
      const params: Record<string, string> = { limit: "20" };
      if (cursor) params.last_doc = cursor;

      const data = await apiGet<BatchJobListResponse>(
        "batch-calling/jobs",
        params,
      );

      if (cursor) {
        setJobs((prev) => [...prev, ...data.batch_calls]);
      } else {
        setJobs(data.batch_calls);
      }
      setNextDoc(data.next_doc);
      setHasMore(data.has_more);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load campaigns",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleCancel = async (batchId: string, name: string | null) => {
    if (!window.confirm(`Cancel campaign "${name || batchId}"? Calls already in progress will complete.`)) {
      return;
    }
    setCancellingId(batchId);
    try {
      await apiPost(`batch-calling/jobs/${batchId}/cancel`);
      await fetchJobs();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to cancel campaign",
      );
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
            >
              VoiceAgent
            </Link>
            <span className="text-sm text-zinc-400">/</span>
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Batch Calling
            </span>
          </div>
          <a
            href="/api/auth/logout"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Log Out
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Campaigns
          </h1>
          <Link
            href="/dashboard/batch-calling/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New Campaign
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-50" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">
              No campaigns yet.{" "}
              <Link
                href="/dashboard/batch-calling/new"
                className="font-medium text-zinc-900 underline dark:text-zinc-50"
              >
                Create your first campaign
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                      Campaign
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                      Agent
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                      Progress
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                      Created
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        <Link
                          href={`/dashboard/batch-calling/${job.id}`}
                          className="hover:underline"
                        >
                          {job.name || "Untitled"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {job.agent_name || job.agent_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        <span className="tabular-nums">
                          {job.total_calls_finished}/{job.total_calls_scheduled}
                        </span>
                        {job.total_calls_scheduled > 0 && (
                          <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                            <div
                              className="h-full rounded-full bg-zinc-900 dark:bg-zinc-50"
                              style={{
                                width: `${Math.round((job.total_calls_finished / job.total_calls_scheduled) * 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                        {formatDate(job.created_at_unix)}
                      </td>
                      <td className="px-4 py-3">
                        {(job.status === "pending" ||
                          job.status === "in_progress") && (
                          <button
                            onClick={() => handleCancel(job.id, job.name)}
                            disabled={cancellingId === job.id}
                            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                          >
                            {cancellingId === job.id
                              ? "Cancelling..."
                              : "Cancel"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    if (nextDoc) fetchJobs(nextDoc);
                  }}
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
