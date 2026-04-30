import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface BackendUserResponse {
  sub: string;
  email: string | null;
  permissions: string[];
}

interface BackendError {
  error: string;
  detail?: string;
}

async function fetchBackendUser(): Promise<{
  data?: BackendUserResponse;
  error?: string;
}> {
  const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

  try {
    const { token } = await auth0.getAccessToken();
    if (!token) {
      return { error: "No access token available" };
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData: BackendError = await response.json();
      return { error: errorData.detail || errorData.error || "Backend error" };
    }

    const data: BackendUserResponse = await response.json();
    return { data };
  } catch {
    return { error: "Backend service unavailable. Is it running on port 8000?" };
  }
}

export default async function DashboardPage() {
  const session = await auth0.getSession();

  if (!session?.user) {
    redirect("/api/auth/login?returnTo=/dashboard");
  }

  const { user } = session;
  const backendResponse = await fetchBackendUser();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
          >
            VoiceAgent
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {user.email}
            </span>
            <a
              href="/api/auth/logout"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Log Out
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>

        {/* Quick Actions */}
        <div className="mb-8">
          <Link
            href="/dashboard/batch-calling"
            className="inline-flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-6 py-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <span className="text-2xl">📞</span>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                Batch Calling
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Launch and manage outbound call campaigns
              </p>
            </div>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Auth0 Session Data
            </h2>
            <div className="flex items-start gap-6">
              {user.picture && (
                <Image
                  src={user.picture}
                  alt={user.name || "User avatar"}
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              )}
              <dl className="grid gap-2 text-sm">
                <div className="flex gap-2">
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    Name:
                  </dt>
                  <dd className="text-zinc-900 dark:text-zinc-50">
                    {user.name || "Not provided"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    Email:
                  </dt>
                  <dd className="text-zinc-900 dark:text-zinc-50">
                    {user.email || "Not provided"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    Email Verified:
                  </dt>
                  <dd className="text-zinc-900 dark:text-zinc-50">
                    {user.emailVerified ? "Yes" : "No"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    User ID:
                  </dt>
                  <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-50">
                    {user.sub}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Backend API Response
            </h2>
            {backendResponse.error ? (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-400">
                  {backendResponse.error}
                </p>
              </div>
            ) : backendResponse.data ? (
              <dl className="grid gap-2 text-sm">
                <div className="flex gap-2">
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    Sub:
                  </dt>
                  <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-50">
                    {backendResponse.data.sub}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    Email:
                  </dt>
                  <dd className="text-zinc-900 dark:text-zinc-50">
                    {backendResponse.data.email || "Not in token"}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    Permissions:
                  </dt>
                  <dd className="text-zinc-900 dark:text-zinc-50">
                    {backendResponse.data.permissions && backendResponse.data.permissions.length > 0 ? (
                      <ul className="list-inside list-disc">
                        {backendResponse.data.permissions.map((perm) => (
                          <li key={perm} className="font-mono text-xs">
                            {perm}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-400">None</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
