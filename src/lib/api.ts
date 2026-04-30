export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const query = params
    ? "?" + new URLSearchParams(params).toString()
    : "";
  const res = await fetch(`/api/proxy/${path}${query}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new ApiError(res.status, err.detail ?? "Unknown error");
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new ApiError(res.status, err.detail ?? "Unknown error");
  }
  return res.json() as Promise<T>;
}
