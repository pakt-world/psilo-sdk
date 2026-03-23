import type { PsiloSDK } from "../services";
import { SDKError } from "../utils/errors";
import type { X402PaymentVerifier, X402VerificationResult } from "./types";

function pickSuccess(body: Record<string, unknown>): X402VerificationResult | null {
  if (body.valid === true) {
    return {
      valid: true,
      payer: typeof body.payer === "string" ? body.payer : undefined,
      amount: typeof body.amount === "string" ? body.amount : undefined,
      token: typeof body.token === "string" ? body.token : undefined,
      raw: typeof body.raw === "object" && body.raw !== null ? (body.raw as Record<string, unknown>) : undefined,
    };
  }
  const inner = body.data;
  if (typeof inner === "object" && inner !== null && (inner as Record<string, unknown>).valid === true) {
    const d = inner as Record<string, unknown>;
    return {
      valid: true,
      payer: typeof d.payer === "string" ? d.payer : undefined,
      amount: typeof d.amount === "string" ? d.amount : undefined,
      token: typeof d.token === "string" ? d.token : undefined,
      raw: typeof d.raw === "object" && d.raw !== null ? (d.raw as Record<string, unknown>) : undefined,
    };
  }
  return null;
}

/**
 * Optional HTTP x402 verifier: `POST {baseUrl}/api/x402/verify` with `{ proof, context }`.
 * Prefer `createEscrowBalanceX402Verifier` for balance-based checks; pass this as `verifier` on `paymentMiddleware` when you use a remote verify endpoint.
 */
export function createPsiloBackendX402Verifier(sdk: PsiloSDK): X402PaymentVerifier {
  return {
    async verify(input): Promise<X402VerificationResult> {
      try {
        const res = (await sdk.connector.post<Record<string, unknown>>("/api/x402/verify", input)) as Record<string, unknown>;
        const ok = pickSuccess(res);
        if (ok) return ok;
        return {
          valid: false,
          reason:
            typeof res.reason === "string"
              ? res.reason
              : typeof res.message === "string"
                ? res.message
                : "Payment verification failed",
          details:
            typeof res.details === "object" && res.details !== null ? (res.details as Record<string, unknown>) : undefined,
        };
      } catch (e) {
        const message = e instanceof SDKError ? e.message : e instanceof Error ? e.message : "Payment verification failed";
        return { valid: false, reason: message };
      }
    },
  };
}
