import { NextRequest, NextResponse } from "next/server";

type OriginValidationResult =
  | { ok: true; origin: string | null }
  | { ok: false; response: NextResponse };

function parseAllowedOrigins(): Set<string> {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

export function validateApiOrigin(req: NextRequest): OriginValidationResult {
  const originHeader = req.headers.get("origin");
  if (!originHeader) return { ok: true, origin: null };

  let originUrl: URL;
  try {
    originUrl = new URL(originHeader);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid origin." }, { status: 403 }),
    };
  }

  if (originUrl.protocol !== "https:" && req.nextUrl.hostname !== "localhost") {
    return {
      ok: false,
      response: NextResponse.json({ error: "HTTPS origin required." }, { status: 403 }),
    };
  }

  const allowedOrigins = parseAllowedOrigins();
  const selfOrigin = req.nextUrl.origin;
  const isAllowed = originUrl.origin === selfOrigin || allowedOrigins.has(originUrl.origin);
  if (!isAllowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Origin not allowed." }, { status: 403 }),
    };
  }

  return { ok: true, origin: originUrl.origin };
}

export function withApiCors(response: NextResponse, allowedOrigin: string | null): NextResponse {
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  return response;
}

