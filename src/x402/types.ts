import type { IncomingHttpHeaders } from "http";
import type { CreateEscrowDto, CreateEscrowResponse, ReleaseResponse } from "../services/escrow/escrow.dto";
import type { ResponseDto } from "../utils/response";
import type { PaymentRouteConfig } from "./payment-routes";

/** Opaque payment proof from the client (headers, signed payload, facilitator token, etc.). */
export type X402PaymentProof = Record<string, unknown>;

export interface X402VerificationContext {
  /** HTTP method and path, or logical resource id, for amount/resource binding. */
  resource?: { method?: string; path?: string };
  /** Expected price in smallest units or decimal string — compared by your verifier. */
  expectedAmount?: string;
  /** Payee identifier your verifier checks against. */
  payTo?: string;
  /** Expected chain id (e.g. Psilo route config `chain`). */
  chainId?: string;
  /** Expected token / asset contract address (e.g. route `currency`). */
  asset?: string;
  /** Route `metadata` from `paymentMiddleware` config, for facilitator / policy checks. */
  metadata?: Record<string, unknown>;
}

export type X402VerificationSuccess = {
  valid: true;
  payer?: string;
  amount?: string;
  token?: string;
  raw?: Record<string, unknown>;
};

export type X402VerificationFailure = {
  valid: false;
  reason: string;
  details?: Record<string, unknown>;
};

export type X402VerificationResult = X402VerificationSuccess | X402VerificationFailure;

/**
 * Gateway hook: validate signature and token / micropayment validity (e.g. via x402 facilitator).
 */
export interface X402PaymentVerifier {
  verify(input: {
    proof: X402PaymentProof;
    context?: X402VerificationContext;
  }): Promise<X402VerificationResult>;
}

/** Request shape for default x402 proof extraction (headers, path, optional query). */
export interface X402ProofRequest {
  method?: string;
  path?: string;
  url?: string;
  headers: IncomingHttpHeaders;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * Second argument to `sdk.paymentMiddleware(buyer, config)`.
 * Reserved keys (`verifier`, `extractProof`, …) are not treated as routes.
 * Omit `verifier` to use the default escrow-balance verifier (`verifyX402PaymentWithEscrowBalance`).
 */
export interface PaymentMiddlewareSecondArg {
  /** Custom verifier; if omitted, payment is verified via Psilo escrow status and balance. */
  verifier?: X402PaymentVerifier;
  extractProof?: (req: X402ProofRequest) => X402PaymentProof | Promise<X402PaymentProof>;
  /** Query param when route `seller` is `query-from-agent` @default "agent" */
  sellerQueryParam?: string;
  /** If true, require verified `payer` to match the buyer address passed to `paymentMiddleware`. */
  strictPayerMatch?: boolean;
  [path: string]:
    | PaymentRouteConfig
    | X402PaymentVerifier
    | ((req: X402ProofRequest) => X402PaymentProof | Promise<X402PaymentProof>)
    | boolean
    | string
    | undefined;
}

/**
 * Machine-readable payment instructions returned on HTTP 402 from {@link PsiloSDK.paymentMiddleware}.
 */
export interface PsiloPaymentRequiredPayload {
  version: "psilo-x402/v1";
  /** Normalized amount (e.g. without a leading `$`) for settlement / comparison. */
  amount: string;
  /** Original configured amount string (may include `$`). */
  amountDisplay: string;
  chainId: string;
  asset: string;
  /** Buyer / payer wallet configured on `paymentMiddleware(buyer, …)`. */
  buyer: string;
  /** Resolved seller when the route defines one. */
  seller?: string;
  resource: { method?: string; path: string };
  metadata?: Record<string, unknown>;
  proof: {
    /** Send a JSON object as this request header. */
    header: string;
    /** Hints for the default escrow-balance verifier (`verifyX402PaymentWithEscrowBalance`). */
    bodyFields: {
      required: readonly ["escrowAddress"];
      optional: readonly ["chainId", "chain", "payer", "buyer"];
    };
  };
}

/** Step 2 — metadata produced when the agent / service runs the task. */
export interface JobExecutionMetadata {
  jobId: string;
  agentId: string;
  /** Estimated settlement amount for escrow (decimal or wei string, matching Psilo API). */
  estimatedCost: string;
  [key: string]: unknown;
}

const X402_METADATA_SCHEMA = "psilo-x402/v1";

export function serializeJobMetadataForEscrow(metadata: JobExecutionMetadata): string {
  return JSON.stringify({ ...metadata, schema: X402_METADATA_SCHEMA });
}

export function parseJobMetadataFromEscrow(description: string | null | undefined): JobExecutionMetadata | null {
  if (!description) return null;
  try {
    const parsed = JSON.parse(description) as Record<string, unknown>;
    if (parsed.schema !== X402_METADATA_SCHEMA) return null;
    const { schema: _s, ...rest } = parsed;
    if (
      typeof rest.jobId === "string" &&
      typeof rest.agentId === "string" &&
      typeof rest.estimatedCost === "string"
    ) {
      return rest as JobExecutionMetadata;
    }
    return null;
  } catch {
    return null;
  }
}

/** Financial and party fields for Step 3 (Psilo escrow), excluding title/description we derive from the job. */
export type X402EscrowCreateParams = Omit<CreateEscrowDto, "title" | "description"> & {
  title?: string;
  description?: string;
};

export interface ReleaseEvaluationContext {
  jobMetadata: JobExecutionMetadata;
  chainId: string;
  escrowAddress: string;
  /** AI / automation reported success. */
  taskSuccess: boolean;
  humanApproved?: boolean;
  disputeResolved?: boolean;
}

/**
 * Step 4 — implement success, human approval, or dispute rules before calling on-chain release.
 */
export interface X402ReleaseConditionEvaluator {
  evaluate(ctx: ReleaseEvaluationContext): Promise<boolean>;
}

export interface X402FlowExecuteResult<T> {
  verification: X402VerificationSuccess;
  result: T;
  metadata: JobExecutionMetadata;
  escrow: ResponseDto<CreateEscrowResponse>;
}

export interface X402ReleaseNotification {
  jobId: string;
  escrowAddress: string;
  chainId: string;
  txHash: string;
  recipientNote?: string;
}
