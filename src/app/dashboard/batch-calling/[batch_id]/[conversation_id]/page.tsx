"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import type { ConversationDetail, TranscriptMessage } from "@/lib/types/batch-calling";

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

function formatTimestamp(secs: number | null): string {
  if (secs === null || secs === undefined) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SuccessBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-zinc-400">—</span>;
  const colors: Record<string, string> = {
    success:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failure: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    unknown:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[value] ?? colors.unknown}`}
    >
      {value}
    </span>
  );
}

export default function ConversationDetailPage() {
  const { batch_id: batchId, conversation_id: conversationId } =
    useParams<{ batch_id: string; conversation_id: string }>();

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setError(null);
        const data = await apiGet<ConversationDetail>(
          `batch-calling/conversations/${conversationId}`,
        );
        setDetail(data);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Failed to load conversation",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [conversationId]);

  // Load audio when detail is available and has_audio is true
  useEffect(() => {
    if (!detail?.has_audio) return;

    let revoked = false;
    const loadAudio = async () => {
      setAudioLoading(true);
      try {
        const res = await fetch(
          `/api/proxy/batch-calling/conversations/${conversationId}/audio`,
        );
        if (!res.ok) throw new Error("Failed to load audio");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (!revoked) setAudioUrl(url);
      } catch {
        // Audio loading is best-effort — don't block the page
      } finally {
        if (!revoked) setAudioLoading(false);
      }
    };
    loadAudio();

    return () => {
      revoked = true;
    };
  }, [detail?.has_audio, conversationId]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Audio time tracking for transcript highlighting
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  // Auto-scroll to active transcript line
  useEffect(() => {
    if (isPlaying && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentTime, isPlaying]);

  // Find the active transcript message based on current audio time
  const getActiveIndex = (transcript: TranscriptMessage[]): number => {
    for (let i = transcript.length - 1; i >= 0; i--) {
      const t = transcript[i].time_in_call_secs;
      if (t !== null && t <= currentTime) return i;
    }
    return -1;
  };

  const seekTo = (secs: number | null) => {
    if (secs === null || !audioRef.current) return;
    audioRef.current.currentTime = secs;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const activeIdx = detail ? getActiveIndex(detail.transcript) : -1;

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
            <Link
              href={`/dashboard/batch-calling/${batchId}`}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Campaign
            </Link>
            <span className="text-sm text-zinc-400">/</span>
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Conversation
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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-50" />
          </div>
        ) : detail ? (
          <>
            {/* Call overview */}
            <div className="mb-8">
              <div className="mb-2 flex items-center gap-4">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  Conversation
                </h1>
                <SuccessBadge value={detail.analysis?.call_successful ?? null} />
              </div>
              <p className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
                {detail.conversation_id}
              </p>
            </div>

            {/* Meta cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Status
                </p>
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                  {detail.status}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Duration
                </p>
                <p className="mt-1 font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatDuration(detail.call_duration_secs)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Started
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {formatDate(detail.start_time_unix)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Ended
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {formatDate(detail.end_time_unix)}
                </p>
              </div>
            </div>

            {/* Summary */}
            {detail.analysis?.transcript_summary && (
              <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Summary
                </h2>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {detail.analysis.transcript_summary}
                </p>
              </div>
            )}

            {/* Audio player */}
            {detail.has_audio && (
              <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Recording
                </h2>
                {audioLoading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
                    Loading audio...
                  </div>
                ) : audioUrl ? (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    controls
                    className="w-full"
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Audio unavailable
                  </p>
                )}
              </div>
            )}

            {/* Transcript */}
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Transcript{" "}
                <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  ({detail.transcript.length} messages)
                </span>
              </h2>
              {detail.transcript.length === 0 ? (
                <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    No transcript available.
                  </p>
                </div>
              ) : (
                <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {detail.transcript.map((msg, i) => {
                      const isActive = i === activeIdx && isPlaying;
                      const isAgent = msg.role === "agent";
                      return (
                        <div
                          key={i}
                          ref={isActive ? activeLineRef : undefined}
                          onClick={() => seekTo(msg.time_in_call_secs)}
                          className={`flex gap-3 px-4 py-3 transition-colors ${
                            audioUrl ? "cursor-pointer" : ""
                          } ${
                            isActive
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          }`}
                        >
                          <div className="flex w-20 shrink-0 items-start gap-2">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                                isAgent
                                  ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              }`}
                            >
                              {isAgent ? "Agent" : "User"}
                            </span>
                          </div>
                          <p className="flex-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                            {msg.message}
                          </p>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                            {formatTimestamp(msg.time_in_call_secs)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Evaluation criteria */}
            {detail.analysis?.evaluation_criteria_results &&
              detail.analysis.evaluation_criteria_results.length > 0 && (
                <div className="mb-8">
                  <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Evaluation Criteria
                  </h2>
                  <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <tr>
                          <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                            Criteria
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                            Result
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                            Rationale
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {detail.analysis.evaluation_criteria_results.map(
                          (ec, i) => (
                            <tr
                              key={ec.criteria_id ?? i}
                              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            >
                              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                                {ec.name ?? "—"}
                              </td>
                              <td className="px-4 py-3">
                                <SuccessBadge value={ec.result} />
                              </td>
                              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                {ec.rationale ?? "—"}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* Data collection results */}
            {detail.analysis?.data_collection_results &&
              detail.analysis.data_collection_results.length > 0 && (
                <div className="mb-8">
                  <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Collected Data
                  </h2>
                  <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <tr>
                          <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                            Field
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                            Value
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                            Rationale
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {detail.analysis.data_collection_results.map(
                          (dc, i) => (
                            <tr
                              key={dc.data_collection_id ?? i}
                              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            >
                              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                                {dc.name ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                {dc.value ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                {dc.rationale ?? "—"}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* Raw metadata */}
            {detail.metadata &&
              Object.keys(detail.metadata).length > 0 && (
                <div className="mb-8">
                  <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Metadata
                  </h2>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <pre className="overflow-x-auto text-xs text-zinc-600 dark:text-zinc-400">
                      {JSON.stringify(detail.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
          </>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">
              Conversation not found.{" "}
              <Link
                href={`/dashboard/batch-calling/${batchId}`}
                className="font-medium text-zinc-900 underline dark:text-zinc-50"
              >
                Back to campaign
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
