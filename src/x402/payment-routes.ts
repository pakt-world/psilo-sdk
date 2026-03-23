import type { IncomingHttpHeaders } from "http";
import { X402PaymentRequiredError } from "./errors";

export interface ConnectStyleRequestLite {
  method?: string;
  url?: string;
  path?: string;
  headers: IncomingHttpHeaders;
}

/** Use in `seller` to resolve the seller address from the request query string. */
export const PAYMENT_SELLER_QUERY_FROM_AGENT = "query-from-agent" as const;

export type PaymentSellerConfig = string | typeof PAYMENT_SELLER_QUERY_FROM_AGENT;

export interface PaymentRouteConfig {
  amount: string;
  chain: string;
  currency: string;
  /** When set, passed to the verifier as `payTo` (or resolved from query when `query-from-agent`). */
  seller?: PaymentSellerConfig;
  metadata?: Record<string, unknown>;
}

export type PaymentRoutesMap = Record<string, PaymentRouteConfig>;

/** Strip a leading `$` and whitespace for verifier / API amount fields. */
export function normalizePaymentAmountDisplay(amount: string): string {
  const t = amount.trim();
  if (t.startsWith("$")) return t.slice(1).trim();
  return t;
}

export function getRequestPathname(req: ConnectStyleRequestLite): string {
  const raw = req.path?.length ? req.path : req.url ?? "/";
  const noQuery = raw.split("?")[0] || "/";
  if (noQuery.startsWith("/")) return noQuery === "" ? "/" : noQuery;
  try {
    return new URL(raw, "http://localhost").pathname || "/";
  } catch {
    return noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
  }
}

export function matchPaymentRoute(pathname: string, routes: PaymentRoutesMap): PaymentRouteConfig | undefined {
  if (routes[pathname]) return routes[pathname];
  const withSlash = pathname.endsWith("/") ? pathname.slice(0, -1) || "/" : pathname;
  if (withSlash !== pathname && routes[withSlash]) return routes[withSlash];
  const withoutSlash = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
  if (withoutSlash !== pathname && routes[withoutSlash]) return routes[withoutSlash];
  return undefined;
}

export interface ResolvePaymentSellerOptions {
  /** @default "agent" */
  queryParam?: string;
}

export type ConnectStyleRequestWithQuery = ConnectStyleRequestLite & {
  query?: Record<string, string | string[] | undefined>;
};

export function resolvePaymentSeller(
  seller: PaymentSellerConfig,
  req: ConnectStyleRequestWithQuery,
  options?: ResolvePaymentSellerOptions,
): string {
  if (seller !== PAYMENT_SELLER_QUERY_FROM_AGENT) return seller;
  const param = options?.queryParam ?? "agent";
  const q = req.query?.[param];
  const v = Array.isArray(q) ? q[0] : q;
  if (typeof v !== "string" || v.length === 0) {
    throw new X402PaymentRequiredError(`Missing seller: query param "${param}" is required when seller is "${PAYMENT_SELLER_QUERY_FROM_AGENT}"`, {
      queryParam: param,
    });
  }
  return v;
}
