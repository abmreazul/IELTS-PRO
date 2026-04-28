import { NextRequest } from "next/server";

function buildUpstreamHeaders(request: NextRequest) {
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch);
  const ifModifiedSince = request.headers.get("if-modified-since");
  if (ifModifiedSince) headers.set("if-modified-since", ifModifiedSince);
  return headers;
}

function buildResponseHeaders(upstream: Response) {
  const headers = new Headers();
  const passThrough = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
    "cache-control",
  ];

  for (const key of passThrough) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set("access-control-allow-origin", "*");
  return headers;
}

async function handleProxy(request: NextRequest, method: "GET" | "HEAD") {
  const source = request.nextUrl.searchParams.get("src");
  if (!source) {
    return new Response("Missing src", { status: 400 });
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(source);
  } catch {
    return new Response("Invalid src", { status: 400 });
  }

  if (!["http:", "https:"].includes(upstreamUrl.protocol)) {
    return new Response("Unsupported src protocol", { status: 400 });
  }

  const upstream = await fetch(upstreamUrl, {
    method,
    headers: buildUpstreamHeaders(request),
    redirect: "follow",
  });

  if (!upstream.ok && upstream.status !== 206 && upstream.status !== 304) {
    return new Response(method === "HEAD" ? null : await upstream.text(), {
      status: upstream.status,
      headers: buildResponseHeaders(upstream),
    });
  }

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: buildResponseHeaders(upstream),
  });
}

export async function GET(request: NextRequest) {
  return handleProxy(request, "GET");
}

export async function HEAD(request: NextRequest) {
  return handleProxy(request, "HEAD");
}
