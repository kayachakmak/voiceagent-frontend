"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

export default function Home() {
  const { user, isLoading } = useUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8 px-8 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          VoiceAgent
        </h1>
        <p className="text-center text-lg text-zinc-600 dark:text-zinc-400">
          Voice-powered AI agent platform
        </p>

        {isLoading ? (
          <div className="h-12 w-32 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        ) : user ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-zinc-700 dark:text-zinc-300">
              Welcome, <span className="font-medium">{user.name}</span>
            </p>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Dashboard
              </Link>
              <a
                href="/api/auth/logout"
                className="flex h-12 items-center justify-center rounded-full border border-zinc-300 px-6 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Log Out
              </a>
            </div>
          </div>
        ) : (
          <a
            href="/api/auth/login"
            className="flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Log In
          </a>
        )}
      </main>
    </div>
  );
}
