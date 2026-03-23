import type { ConnectStyleNext, ConnectStyleResponse } from "./middleware";
import type { ConnectStyleRequestWithQuery } from "./payment-routes";
import { generateRequestHash, type X402EscrowRequestLike } from "./request-hash";
import type { CreateX402EscrowResult, X402PsiloEscrowService } from "./psilo-escrow.service";
import { encodeX402EscrowId } from "./psilo-escrow.service";
import type { X402EscrowPaymentRequiredBody, X402EscrowRequestContext } from "./x402-escrow.types";

const LOCALS_KEY = "x402Escrow";

export type X402EscrowMiddlewareRequest = ConnectStyleRequestWithQuery & { body?: unknown };

export interface X402EscrowMiddlewareOptions {
  chainId: string;
  seller: string;
  /** Token contract address — always server-defined, never from the client body. */
  asset: string;
  /** Settlement amount — server-defined. */
  amount: number | string;
  tokenSymbol?: string;
  /** Resolve the payer wallet (e.g. from `Authorization` or session). */
  getBuyerAddress: (req: X402EscrowRequestLike) => string | undefined | Promise<string | undefined>;
  expiresInMs?: number;
  /** @default x402-escrow-id */
  escrowHeaderName?: string;
  titlePrefix?: string;
}

function paymentBodyFromCreated(created: CreateX402EscrowResult): X402EscrowPaymentRequiredBody {
  return {
    error: "Payment Required",
    payment: {
      type: "escrow",
      escrowId: created.escrowId,
      escrowAddress: created.address,
      amount: created.amount,
      token: created.tokenSymbol,
      expiresAt: created.expiresAt,
      chainId: created.chainId,
      asset: created.asset,
      escrowDetails: created.escrowDetails,
    },
  };
}

function paymentBodyFromRecord(rec: {
  chainId: string;
  escrowAddress: string;
  amountStr: string;
  tokenSymbol: string;
  asset: string;
  expiresAt: number;
  escrowDetails: CreateX402EscrowResult["escrowDetails"];
}): X402EscrowPaymentRequiredBody {
  const amount = parseFloat(rec.amountStr) || Number(rec.amountStr) || 0;
  return {
    error: "Payment Required",
    payment: {
      type: "escrow",
      escrowId: encodeX402EscrowId(rec.chainId, rec.escrowAddress),
      escrowAddress: rec.escrowAddress,
      amount,
      token: rec.tokenSymbol,
      expiresAt: new Date(rec.expiresAt).toISOString(),
      chainId: rec.chainId,
      asset: rec.asset,
      escrowDetails: rec.escrowDetails,
    },
  };
}

/**
 * x402 flow: pre-create Psilo escrow → 402 with funding details → client funds → retry with `x402-escrow-id`.
 */
export function createX402EscrowMiddleware(
  service: X402PsiloEscrowService,
  options: X402EscrowMiddlewareOptions,
): (req: X402EscrowMiddlewareRequest, res: ConnectStyleResponse, next: ConnectStyleNext) => Promise<void> {
  const headerName = (options.escrowHeaderName ?? "x402-escrow-id").toLowerCase();

  return async (req, res, next) => {
    const buyerRaw = await options.getBuyerAddress(req);
    const buyer = buyerRaw?.trim();
    if (!buyer) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Buyer wallet could not be resolved for x402 escrow payment",
      });
      return;
    }

    const requestHash = generateRequestHash(req as X402EscrowRequestLike, { buyerBinding: buyer });
    const rawEscrow = req.headers[headerName];
    const escrowIdHeader = (Array.isArray(rawEscrow) ? rawEscrow[0] : rawEscrow)?.trim();

    if (!escrowIdHeader) {
      try {
        const created = await service.createEscrow({
          buyer,
          seller: options.seller,
          amount: options.amount,
          token: options.asset,
          chainId: options.chainId,
          requestHash,
          tokenSymbol: options.tokenSymbol,
          expiresInMs: options.expiresInMs,
          title: options.titlePrefix ? `${options.titlePrefix} ${requestHash.slice(0, 8)}` : undefined,
        });
        res.status(402).json(paymentBodyFromCreated(created));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Escrow creation failed";
        res.status(502).json({ error: "Bad Gateway", message });
      }
      return;
    }

    const row = await service.getEscrow(escrowIdHeader);
    if (!row) {
      res.status(402).json({
        error: "Payment Required",
        message: "Unknown or expired escrow id",
        code: "X402_ESCROW_UNKNOWN",
      });
      return;
    }

    const { record } = row;
    if (record.buyer.toLowerCase() !== buyer.toLowerCase()) {
      res.status(403).json({
        error: "Forbidden",
        message: "Escrow buyer does not match the authenticated payer",
        code: "X402_ESCROW_BUYER_MISMATCH",
      });
      return;
    }

    if (record.requestHash !== requestHash) {
      res.status(402).json({
        error: "Payment Required",
        message: "Escrow was created for a different request payload",
        code: "X402_REQUEST_HASH_MISMATCH",
      });
      return;
    }

    if (row.status !== "FUNDED") {
      res.status(402).json({
        ...paymentBodyFromRecord(record),
        message: row.status === "RELEASED" ? "Escrow already released; start a new payment without x402-escrow-id" : "Escrow not funded yet",
        code: row.status === "RELEASED" ? "X402_ESCROW_RELEASED" : "X402_AWAITING_FUNDS",
      });
      return;
    }

    if (!res.locals) res.locals = {};
    const ctx: X402EscrowRequestContext = {
      id: row.id,
      chainId: record.chainId,
      escrowAddress: record.escrowAddress,
      requestHash: record.requestHash,
      buyer: record.buyer,
      seller: record.seller,
      amount: record.amountStr,
      asset: record.asset,
      tokenSymbol: record.tokenSymbol,
    };
    (res.locals as Record<string, unknown>)[LOCALS_KEY] = ctx;
    next();
  };
}

export const X402_ESCROW_LOCALS_KEY = LOCALS_KEY;

export function getX402EscrowContext(res: ConnectStyleResponse): X402EscrowRequestContext | undefined {
  const loc = res.locals as Record<string, unknown> | undefined;
  return loc?.[LOCALS_KEY] as X402EscrowRequestContext | undefined;
}
