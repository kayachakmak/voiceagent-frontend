import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function GET(request: NextRequest) {
  const response = await auth0.middleware(request);

  // If middleware returned a redirect or other response, use it
  // If it returned NextResponse.next(), return a simple response
  if (response.headers.get("x-middleware-next") === "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
