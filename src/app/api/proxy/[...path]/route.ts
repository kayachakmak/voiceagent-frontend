import { auth0 } from "@/lib/auth0";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  const pathString = path.join("/");
  const url = `${BACKEND_URL}/api/v1/${pathString}${request.nextUrl.search}`;

  let accessToken: string;
  try {
    const { token } = await auth0.getAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 401 }
      );
    }
    accessToken = token;
  } catch (err) {
    console.error("Proxy auth error:", err);
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) {
      fetchOptions.body = body;
    }
  }

  try {
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    // Binary responses (audio, etc.) — pass through as-is
    if (!contentType.includes("application/json")) {
      const body = await response.arrayBuffer();
      return new NextResponse(body, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
          ...(response.headers.get("content-disposition")
            ? { "Content-Disposition": response.headers.get("content-disposition")! }
            : {}),
        },
      });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach backend service" },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return proxyRequest(request, context);
}
