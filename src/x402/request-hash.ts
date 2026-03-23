import type { IncomingHttpHeaders } from "http";
import { createHash } from "crypto";

export interface X402EscrowRequestLike {
  method?: string;
  path?: string;
  url?: string;
  body?: unknown;
  headers: IncomingHttpHeaders;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function getPathname(req: X402EscrowRequestLike): string {
  if (req.path && req.path.length > 0) {
    return req.path.split("?")[0] || "/";
  }
  if (req.url) {
    const raw = req.url.split("?")[0] || "/";
    if (raw.startsWith("/")) return raw;
    try {
      return new URL(req.url, "http://localhost").pathname || "/";
    } catch {
      return raw.startsWith("/") ? raw : `/${raw}`;
    }
  }
  return "/";
}

export interface GenerateRequestHashOptions {
  /**
   * Bind the hash to a wallet (recommended). Prevents cross-user replay of the same body.
   */
  buyerBinding?: string;
}

/**
 * SHA-256 over method, path, stable JSON body, and optional buyer binding.
 */
export function generateRequestHash(req: X402EscrowRequestLike, options?: GenerateRequestHashOptions): string {
  const method = (req.method ?? "GET").toUpperCase();
  const path = getPathname(req);
  const body = stableStringify(req.body ?? {});
  const binding = options?.buyerBinding ?? "";
  const payload = `${method}\n${path}\n${body}\n${binding}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
