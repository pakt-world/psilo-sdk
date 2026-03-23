import type { IncomingHttpHeaders } from "http";
import type { PsiloSDK } from "../services";
import type { ReleaseDto, ReleaseResponse } from "../services/escrow/escrow.dto";
import type { ResponseDto } from "../utils/response";
import { isX402PaymentRequiredError } from "./errors";
import type {
  JobExecutionMetadata,
  ReleaseEvaluationContext,
  X402EscrowCreateParams,
  X402FlowExecuteResult,
  X402PaymentProof,
  X402PaymentVerifier,
  X402ReleaseConditionEvaluator,
  X402ReleaseNotification,
  X402VerificationContext,
  X402VerificationSuccess,
} from "./types";
import { PsiloX402Wrapper } from "./wrapper";

export interface X402MiddlewareErrorBody {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Maps thrown errors to HTTP status and JSON body. {@link X402PaymentRequiredError} → 402.
 */
export function mapX402MiddlewareError(err: unknown): X402MiddlewareErrorBody {
  if (isX402PaymentRequiredError(err)) {
    return {
      status: err.statusCode,
      body: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
  }
  const message = err instanceof Error ? err.message : "Internal error";
  return {
    status: 500,
    body: { code: "INTERNAL_ERROR", message },
  };
}

/**
 * Options for a single protected route: Step 1 (verify) → Step 2 (execute) → Step 3 (escrow).
 */
export interface CreateX402ProtectedHandlerOptions<TReq, TResult> {
  psilo: PsiloSDK;
  verifier: X402PaymentVerifier;
  extractProof: (req: TReq) => X402PaymentProof | Promise<X402PaymentProof>;
  verificationContext?: (req: TReq) => X402VerificationContext | undefined | Promise<X402VerificationContext | undefined>;
  escrowParams: (
    req: TReq,
    verification: X402VerificationSuccess,
  ) => X402EscrowCreateParams | Promise<X402EscrowCreateParams>;
  /**
   * Step 2 — agent / service work and job metadata (job id, agent id, estimated cost).
   */
  execute: (
    verification: X402VerificationSuccess,
    req: TReq,
  ) => Promise<{ result: TResult; metadata: JobExecutionMetadata }>;
}

/**
 * Returns an async function that runs the x402 → service → Psilo escrow pipeline for one request.
 * Use inside any HTTP framework: call the returned handler, then {@link mapX402MiddlewareError} in catch.
 */
export function createX402ProtectedHandler<TReq, TResult>(
  options: CreateX402ProtectedHandlerOptions<TReq, TResult>,
): (req: TReq) => Promise<X402FlowExecuteResult<TResult>> {
  const wrapper = new PsiloX402Wrapper(options.psilo);
  return async (req: TReq) => {
    const proof = await options.extractProof(req);
    const context = options.verificationContext ? await options.verificationContext(req) : undefined;
    const verification = await wrapper.verifyPayment(proof, options.verifier, context);
    const escrowParams = await options.escrowParams(req, verification);
    return wrapper.executeAndCreateEscrow(verification, (v) => options.execute(v, req), escrowParams);
  };
}

/** Minimal request shape for Connect, Express, Polka, etc. */
export interface ConnectStyleRequest {
  method?: string;
  url?: string;
  path?: string;
  headers: IncomingHttpHeaders;
}

/** Minimal response shape for Connect / Express (`res.status().json()`). */
export interface ConnectStyleResponse {
  locals?: Record<string, unknown>;
  status(code: number): ConnectStyleResponse;
  json(body: unknown): unknown;
}

export type ConnectStyleNext = (err?: unknown) => void;

export type ConnectStyleX402Middleware<
  TReq extends ConnectStyleRequest = ConnectStyleRequest,
  TRes extends ConnectStyleResponse = ConnectStyleResponse,
> = (req: TReq, res: TRes, next: ConnectStyleNext) => void | Promise<void>;

function ensureLocals(res: ConnectStyleResponse): Record<string, unknown> {
  if (!res.locals) res.locals = {};
  return res.locals;
}

export interface ConnectStyleX402MiddlewareOptions<TReq, TRes, TResult>
  extends CreateX402ProtectedHandlerOptions<TReq, TResult> {
  /**
   * When true (default), finish the response on success (or delegate entirely to `onSuccess`).
   * When false, attach {@link X402FlowExecuteResult} to `res.locals[localsKey]` and call `next()`.
   */
  endResponse?: boolean;
  /** @default "psiloX402" */
  localsKey?: string;
  /** If set, you are responsible for writing the success response (when `endResponse`) or populating `locals`. */
  onSuccess?: (req: TReq, res: TRes, result: X402FlowExecuteResult<TResult>) => void | Promise<void>;
  /** Override default JSON error responses. */
  onError?: (req: TReq, res: TRes, err: unknown, mapped: X402MiddlewareErrorBody) => void | Promise<void>;
}

/**
 * Connect-style middleware `(req, res, next)` — works with **Express**, **Polka**, **@tinyhttp/app**, and any stack using this signature.
 */
export function createConnectStyleX402Middleware<TReq extends ConnectStyleRequest, TRes extends ConnectStyleResponse, TResult>(
  options: ConnectStyleX402MiddlewareOptions<TReq, TRes, TResult>,
): ConnectStyleX402Middleware<TReq, TRes> {
  const run = createX402ProtectedHandler(options);
  const endResponse = options.endResponse !== false;
  const localsKey = options.localsKey ?? "psiloX402";

  return async (req, res, next) => {
    try {
      const result = await run(req as TReq);
      if (options.onSuccess) {
        await options.onSuccess(req as TReq, res as TRes, result);
      } else if (endResponse) {
        res.status(200).json(result);
      } else {
        ensureLocals(res)[localsKey] = result;
      }
      if (!endResponse) next();
    } catch (err) {
      const mapped = mapX402MiddlewareError(err);
      if (options.onError) {
        await options.onError(req as TReq, res as TRes, err, mapped);
        return;
      }
      res.status(mapped.status).json(mapped.body);
    }
  };
}

/** Alias for {@link createConnectStyleX402Middleware} — same `(req, res, next)` signature Express uses. */
export const createExpressX402Middleware = createConnectStyleX402Middleware;

/** Fastify (and similar) reply: `reply.code(n).send(body)`. */
export interface FastifyStyleReply {
  code(statusCode: number): FastifyStyleReply;
  send(payload?: unknown): unknown;
}

export interface FastifyStyleX402RouteOptions<TReq, TResult>
  extends CreateX402ProtectedHandlerOptions<TReq, TResult> {
  /**
   * Map the framework request to `TReq` (e.g. `(request) => request as Request` or attach parsed body).
   * Omit if `TReq` is already the framework's request type.
   */
  mapRequest?: <TFrameworkReq>(frameworkReq: TFrameworkReq) => TReq | Promise<TReq>;
  onSuccess?: (req: TReq, reply: FastifyStyleReply, result: X402FlowExecuteResult<TResult>) => void | Promise<void>;
  onError?: (req: TReq, reply: FastifyStyleReply, err: unknown, mapped: X402MiddlewareErrorBody) => void | Promise<void>;
}

/**
 * Returns an async route/preHandler for **Fastify** (`async (request, reply) => { ... }`).
 * Default success: `reply.code(200).send(result)`.
 */
export function createFastifyStyleX402Handler<TReq, TFrameworkReq, TResult>(
  options: FastifyStyleX402RouteOptions<TReq, TResult> & {
    mapRequest: (frameworkReq: TFrameworkReq) => TReq | Promise<TReq>;
  },
): (frameworkReq: TFrameworkReq, reply: FastifyStyleReply) => Promise<void>;

export function createFastifyStyleX402Handler<TReq, TResult>(
  options: FastifyStyleX402RouteOptions<TReq, TResult> & { mapRequest?: undefined },
): (frameworkReq: TReq, reply: FastifyStyleReply) => Promise<void>;

export function createFastifyStyleX402Handler<TReq, TFrameworkReq, TResult>(
  options: FastifyStyleX402RouteOptions<TReq, TResult> & {
    mapRequest?: (frameworkReq: TFrameworkReq) => TReq | Promise<TReq>;
  },
): (frameworkReq: TFrameworkReq, reply: FastifyStyleReply) => Promise<void> {
  const run = createX402ProtectedHandler(options);
  const mapRequest = options.mapRequest ?? ((r: TFrameworkReq) => r as unknown as TReq);

  return async (frameworkReq, reply) => {
    const req = await mapRequest(frameworkReq);
    try {
      const result = await run(req);
      if (options.onSuccess) {
        await options.onSuccess(req, reply, result);
      } else {
        reply.code(200).send(result);
      }
    } catch (err) {
      const mapped = mapX402MiddlewareError(err);
      if (options.onError) {
        await options.onError(req, reply, err, mapped);
        return;
      }
      reply.code(mapped.status).send(mapped.body);
    }
  };
}

export interface ConnectStyleX402ReleaseMiddlewareOptions<TReq extends ConnectStyleRequest, TRes extends ConnectStyleResponse>
  extends CreateX402ConditionalReleaseHandlerOptions<TReq> {
  endResponse?: boolean;
  localsKey?: string;
  onSuccess?: (req: TReq, res: TRes, result: X402ConditionalReleaseHandlerResult) => void | Promise<void>;
  onError?: (req: TReq, res: TRes, err: unknown, mapped: X402MiddlewareErrorBody) => void | Promise<void>;
}

/**
 * Connect/Express middleware for Step 4 (conditional release + optional notification).
 */
export function createConnectStyleX402ReleaseMiddleware<
  TReq extends ConnectStyleRequest,
  TRes extends ConnectStyleResponse,
>(
  options: ConnectStyleX402ReleaseMiddlewareOptions<TReq, TRes>,
): ConnectStyleX402Middleware<TReq, TRes> {
  const run = createX402ConditionalReleaseHandler(options);
  const endResponse = options.endResponse !== false;
  const localsKey = options.localsKey ?? "psiloX402Release";

  return async (req, res, next) => {
    try {
      const result = await run(req as TReq);
      if (options.onSuccess) {
        await options.onSuccess(req as TReq, res as TRes, result);
      } else if (endResponse) {
        res.status(200).json(result);
      } else {
        ensureLocals(res)[localsKey] = result;
      }
      if (!endResponse) next();
    } catch (err) {
      const mapped = mapX402MiddlewareError(err);
      if (options.onError) {
        await options.onError(req as TReq, res as TRes, err, mapped);
        return;
      }
      res.status(mapped.status).json(mapped.body);
    }
  };
}

export const createExpressX402ReleaseMiddleware = createConnectStyleX402ReleaseMiddleware;

export interface FastifyStyleX402ReleaseOptions<TReq> extends CreateX402ConditionalReleaseHandlerOptions<TReq> {
  mapRequest?: <TFrameworkReq>(frameworkReq: TFrameworkReq) => TReq | Promise<TReq>;
  onSuccess?: (req: TReq, reply: FastifyStyleReply, result: X402ConditionalReleaseHandlerResult) => void | Promise<void>;
  onError?: (req: TReq, reply: FastifyStyleReply, err: unknown, mapped: X402MiddlewareErrorBody) => void | Promise<void>;
}

export function createFastifyStyleX402ReleaseHandler<TReq, TFrameworkReq>(
  options: FastifyStyleX402ReleaseOptions<TReq> & {
    mapRequest: (frameworkReq: TFrameworkReq) => TReq | Promise<TReq>;
  },
): (frameworkReq: TFrameworkReq, reply: FastifyStyleReply) => Promise<void>;

export function createFastifyStyleX402ReleaseHandler<TReq>(
  options: FastifyStyleX402ReleaseOptions<TReq> & { mapRequest?: undefined },
): (frameworkReq: TReq, reply: FastifyStyleReply) => Promise<void>;

export function createFastifyStyleX402ReleaseHandler<TReq, TFrameworkReq>(
  options: FastifyStyleX402ReleaseOptions<TReq> & {
    mapRequest?: (frameworkReq: TFrameworkReq) => TReq | Promise<TReq>;
  },
): (frameworkReq: TFrameworkReq, reply: FastifyStyleReply) => Promise<void> {
  const run = createX402ConditionalReleaseHandler(options);
  const mapRequest = options.mapRequest ?? ((r: TFrameworkReq) => r as unknown as TReq);

  return async (frameworkReq, reply) => {
    const req = await mapRequest(frameworkReq);
    try {
      const result = await run(req);
      if (options.onSuccess) {
        await options.onSuccess(req, reply, result);
      } else {
        reply.code(200).send(result);
      }
    } catch (err) {
      const mapped = mapX402MiddlewareError(err);
      if (options.onError) {
        await options.onError(req, reply, err, mapped);
        return;
      }
      reply.code(mapped.status).send(mapped.body);
    }
  };
}

export interface CreateX402ConditionalReleaseHandlerOptions<TReq> {
  psilo: PsiloSDK;
  evaluator: X402ReleaseConditionEvaluator;
  buildContext: (req: TReq) => ReleaseEvaluationContext | Promise<ReleaseEvaluationContext>;
  releasePayload?: (req: TReq) => ReleaseDto | undefined | Promise<ReleaseDto | undefined>;
}

/**
 * Step 4 — evaluate release conditions, release escrow if allowed, optionally build {@link PsiloX402Wrapper.buildReleaseNotification}.
 */
export interface X402ConditionalReleaseHandlerResult {
  release: ResponseDto<ReleaseResponse>;
  notification?: X402ReleaseNotification;
}

export function createX402ConditionalReleaseHandler<TReq>(
  options: CreateX402ConditionalReleaseHandlerOptions<TReq>,
): (req: TReq) => Promise<X402ConditionalReleaseHandlerResult> {
  const wrapper = new PsiloX402Wrapper(options.psilo);
  return async (req: TReq) => {
    const ctx = await options.buildContext(req);
    const releasePayload = options.releasePayload ? await options.releasePayload(req) : undefined;
    const release = await wrapper.releaseConditionally(options.evaluator, ctx, releasePayload);
    const txHash = release.data?.txHash;
    const notification =
      txHash !== undefined && txHash !== ""
        ? PsiloX402Wrapper.buildReleaseNotification(ctx.jobMetadata, ctx.chainId, ctx.escrowAddress, txHash)
        : undefined;
    return { release, notification };
  };
}
