"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { StatusBadge } from "@/components/batch-calling/StatusBadge";
import type {
  BatchDetail,
  ConversationSummary,
  ConversationListResponse,
} from "@/lib/types/batch-calling";

const POLL_INTERVAL_MS = 5000;
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString();
}

function formatDuration(secs: number | null): string {
  if (secs === null || secs === undefined) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function BatchMonitoringPage() {
  const { batch_id: batchId } = useParams<{ batch_id: string }>();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentIdRef = useRef<string | null>(null);

  const fetchBatchStatus = useCallback(async () => {
    const data = await apiGet<BatchDetail>(
      `batch-calling/jobs/${batchId}`,
    );
    setBatch(data);
    agentIdRef.current = data.agent_id;
    return data;
  }, [batchId]);

  const fetchConversations = useCallback(async (batchRecipients: BatchDetail["recipients"]) => {
    const agentId = agentIdRef.current;
    if (!agentId) return;

    // Collect conversation IDs that belong to this batch
    const batchConvIds = new Set(
      batchRecipients
        .map((r) => r.conversation_id)
        .filter((id): id is string => id !== null && id !== undefined),
    );

    if (batchConvIds.size === 0) {
      setConversations([]);
      return;
    }

    const data = await apiGet<ConversationListResponse>(
      "batch-calling/conversations",
      { agent_id: agentId, page_size: "50" },
    );

    // Filter to only conversations belonging to this batch
    const filtered = data.conversations.filter((c) =>
      batchConvIds.has(c.conversation_id),
    );
    setConversations(filtered);
  }, []);

  const poll = useCallback(async () => {
    try {
      setPollError(null);
      const data = await fetchBatchStatus();
      await fetchConversations(data.recipients);
      if (TERMINAL_STATUSES.has(data.status)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      setPollError(
        err instanceof ApiError ? err.message : "Polling failed",
      );
    }
  }, [fetchBatchStatus, fetchConversations]);

  // Initial fetch + polling setup
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setError(null);
        const data = await fetchBatchStatus();
        await fetchConversations(data.recipients);

        if (!cancelled && !TERMINAL_STATUSES.has(data.status)) {
          intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load campaign",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchBatchStatus, fetchConversations, poll]);

  const handleCancel = async () => {
    if (!batch) return;
    if (
      !window.confirm(
        `Cancel campaign "${batch.name || batchId}"? Calls already in progress will complete.`,
      )
    )
      return;

    setCancelling(true);
    try {
      await apiPost(`batch-calling/jobs/${batchId}/cancel`);
      await fetchBatchStatus();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to cancel campaign",
      );
    } finally {
      setCancelling(false);
    }
  };

  // Build a lookup from conversation_id → conversation data (for duration in recipients table)
  const convMap = new Map(
    conversations.map((c) => [c.conversation_id, c]),
  );

  // Progress calculations
  const scheduled = batch?.total_calls_scheduled ?? 0;
  const finished = batch?.total_calls_finished ?? 0;
  const pct = scheduled > 0 ? Math.round((finished / scheduled) * 100) : 0;
  const isActive =
    batch?.status === "pending" || batch?.status === "in_progress";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
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
            <Link
              href="/dashboard/batch-calling"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Batch Calling
            </Link>
            <span className="text-sm text-zinc-400">/</span>
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {batch?.name || "Campaign"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isActive && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {cancelling ? "Cancelling..." : "Cancel Campaign"}
              </button>
            )}
            <a
              href="/api/auth/logout"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Log Out
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Error states */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm font-medium text-red-700 underline dark:text-red-400"
            >
              Retry
            </button>
          </div>
        )}

        {pollError && (
          <div className="mb-6 rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Polling error: {pollError}. Retrying...
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-50" />
          </div>
        ) : batch ? (
          <>
            {/* Status header */}
            <div className="mb-8 flex items-center gap-4">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {batch.name || "Untitled Campaign"}
              </h1>
              <StatusBadge status={batch.status} />
            </div>

            {/* Stat cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Scheduled", value: batch.total_calls_scheduled },
                { label: "Dispatched", value: batch.total_calls_dispatched },
                { label: "Finished", value: batch.total_calls_finished },
                { label: "Retries", value: batch.retry_count },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Progress
                </span>
                <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                  {finished} of {scheduled} calls completed ({pct}%)
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all duration-500 dark:bg-zinc-50"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Meta info */}
            <div className="mb-8 flex gap-6 text-sm text-zinc-500 dark:text-zinc-400">
              <span>Created: {formatDate(batch.created_at_unix)}</span>
              {batch.scheduled_time_unix && (
                <span>
                  Scheduled: {formatDate(batch.scheduled_time_unix)}
                </span>
              )}
              {batch.last_updated_at_unix && (
                <span>
                  Last updated: {formatDate(batch.last_updated_at_unix)}
                </span>
              )}
            </div>

            {/* Live conversation feed */}
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Completed Calls{" "}
                <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  ({conversations.length})
                </span>
              </h2>
              {conversations.length === 0 ? (
                <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Waiting for calls to complete...
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Conversation ID
                        </th>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Status
                        </th>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Duration
                        </th>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Success
                        </th>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Started
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {conversations.map((conv) => (
                        <tr
                          key={conv.conversation_id}
                          className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          onClick={() =>
                            window.location.assign(
                              `/dashboard/batch-calling/${batchId}/${conv.conversation_id}`,
                            )
                          }
                        >
                          <td className="px-4 py-3 font-mono text-xs text-zinc-900 dark:text-zinc-50">
                            {conv.conversation_id.slice(0, 12)}...
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                            {conv.status}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                            {formatDuration(conv.call_duration_secs)}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                            {conv.call_successful ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                            {formatDate(conv.start_time_unix)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recipients table */}
            {batch.recipients.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Recipients{" "}
                  <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                    ({batch.recipients.length})
                  </span>
                </h2>
                <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Phone Number
                        </th>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Status
                        </th>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Conversation ID
                        </th>
                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {batch.recipients.map((r, i) => (
                        <tr
                          key={`${r.phone_number}-${i}`}
                          className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${r.conversation_id ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (r.conversation_id) {
                              window.location.assign(
                                `/dashboard/batch-calling/${batchId}/${r.conversation_id}`,
                              );
                            }
                          }}
                        >
                          <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                            {r.phone_number}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                            {r.status}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                            {r.conversation_id
                              ? r.conversation_id.slice(0, 12) + "..."
                              : "—"}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                            {formatDuration(
                              r.call_duration_secs ??
                                (r.conversation_id
                                  ? convMap.get(r.conversation_id)?.call_duration_secs ?? null
                                  : null),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">
              Campaign not found.{" "}
              <Link
                href="/dashboard/batch-calling"
                className="font-medium text-zinc-900 underline dark:text-zinc-50"
              >
                Back to campaigns
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
