import type { PsiloSDK } from "../services";
import { X402PaymentRequiredError } from "./errors";
import type { ConnectStyleNext, ConnectStyleResponse, ConnectStyleX402Middleware } from "./middleware";
import { mapX402MiddlewareError } from "./middleware";
import { createEscrowBalanceX402Verifier } from "./escrow-balance-verifier";
import {
  getRequestPathname,
  matchPaymentRoute,
  normalizePaymentAmountDisplay,
  resolvePaymentSeller,
  type ConnectStyleRequestWithQuery,
  type PaymentRouteConfig,
  type PaymentRoutesMap,
} from "./payment-routes";
import type {
  PaymentMiddlewareSecondArg,
  PsiloPaymentRequiredPayload,
  X402PaymentProof,
  X402VerificationSuccess,
} from "./types";
import { PsiloX402Wrapper } from "./wrapper";

const DEFAULT_PROOF_HEADER = "x-payment-proof";

const PAYMENT_MIDDLEWARE_OPTION_KEYS = new Set([
  "verifier",
  "extractProof",
  "sellerQueryParam",
  "strictPayerMatch",
]);

/** Attached by `paymentMiddleware` on successful verification (`res.locals.psiloPayment`). */
export interface PsiloPaymentLocals {
  buyerAddress: string;
  routePath: string;
  route: PaymentRouteConfig;
  verification: X402VerificationSuccess;
  /** Present when the route config included `seller`. */
  seller?: string;
}

function defaultExtractProof(req: ConnectStyleRequestWithQuery): X402PaymentProof {
  const raw = req.headers[DEFAULT_PROOF_HEADER];
  const h = Array.isArray(raw) ? raw[0] : raw;
  if (typeof h === "string" && h.length > 0) {
    try {
      return JSON.parse(h) as X402PaymentProof;
    } catch {
      return { raw: h };
    }
  }
  return {};
}

function routesFromPaymentMiddlewareConfig(config: PaymentMiddlewareSecondArg): PaymentRoutesMap {
  const routes: PaymentRoutesMap = {};
  for (const key of Object.keys(config)) {
    if (PAYMENT_MIDDLEWARE_OPTION_KEYS.has(key)) continue;
    routes[key] = config[key] as PaymentRouteConfig;
  }
  return routes;
}

interface PaymentRequiredContext {
  pathname: string;
  method?: string;
  route: PaymentRouteConfig;
  buyerAddress: string;
  seller?: string;
}

function buildPsiloPaymentRequiredPayload(ctx: PaymentRequiredContext): PsiloPaymentRequiredPayload {
  return {
    version: "psilo-x402/v1",
    amount: normalizePaymentAmountDisplay(ctx.route.amount),
    amountDisplay: ctx.route.amount.trim(),
    chainId: ctx.route.chain,
    asset: ctx.route.currency,
    buyer: ctx.buyerAddress,
    ...(ctx.seller !== undefined && ctx.seller.length > 0 ? { seller: ctx.seller } : {}),
    resource: { method: ctx.method, path: ctx.pathname },
    ...(ctx.route.metadata !== undefined ? { metadata: ctx.route.metadata } : {}),
    proof: {
      header: DEFAULT_PROOF_HEADER,
      bodyFields: {
        required: ["escrowAddress"],
        optional: ["chainId", "chain", "payer", "buyer"],
      },
    },
  };
}

function respondPaymentMiddlewareError(
  res: ConnectStyleResponse,
  err: unknown,
  paymentCtx: PaymentRequiredContext,
): void {
  const mapped = mapX402MiddlewareError(err);
  if (mapped.status === 402) {
    res.status(402).json({
      ...mapped.body,
      paymentRequired: buildPsiloPaymentRequiredPayload(paymentCtx),
    });
    return;
  }
  res.status(mapped.status).json(mapped.body);
}

export type PaymentMiddlewareFactory = (
  buyerAddress: string,
  config: PaymentMiddlewareSecondArg,
) => ConnectStyleX402Middleware<ConnectStyleRequestWithQuery, ConnectStyleResponse>;

export function createPaymentMiddlewareFactory(sdk: PsiloSDK): PaymentMiddlewareFactory {
  return function paymentMiddleware(
    buyerAddress: string,
    config: PaymentMiddlewareSecondArg,
  ): ConnectStyleX402Middleware<ConnectStyleRequestWithQuery, ConnectStyleResponse> {
    const verifier = config.verifier ?? createEscrowBalanceX402Verifier(sdk);
    const extractProof = config.extractProof ?? defaultExtractProof;
    const sellerQueryParam = config.sellerQueryParam;
    const strictPayer = config.strictPayerMatch === true;
    const routes = routesFromPaymentMiddlewareConfig(config);
    const wrapper = new PsiloX402Wrapper(sdk);

    return async (req, res, next: ConnectStyleNext) => {
      const pathname = getRequestPathname(req);
      const route = matchPaymentRoute(pathname, routes);
      if (!route) {
        next();
        return;
      }

      let seller: string | undefined;
      try {
        const proof = await extractProof(req);
        if (route.seller !== undefined) {
          try {
            seller = resolvePaymentSeller(route.seller, req, { queryParam: sellerQueryParam });
          } catch (e) {
            if (e instanceof X402PaymentRequiredError) {
              respondPaymentMiddlewareError(res, e, {
                pathname,
                method: req.method,
                route,
                buyerAddress,
              });
              return;
            }
            throw e;
          }
        }

        const expectedAmount = normalizePaymentAmountDisplay(route.amount);
        const verification = await wrapper.verifyPayment(proof, verifier, {
          resource: { method: req.method, path: pathname },
          expectedAmount,
          ...(seller !== undefined ? { payTo: seller } : {}),
          chainId: route.chain,
          asset: route.currency,
          ...(route.metadata !== undefined ? { metadata: route.metadata } : {}),
        });

        if (strictPayer) {
          if (!verification.payer || verification.payer.toLowerCase() !== buyerAddress.toLowerCase()) {
            throw new X402PaymentRequiredError("Payer does not match configured buyer address", {
              expectedBuyer: buyerAddress,
              payer: verification.payer,
            });
          }
        }

        if (!res.locals) res.locals = {};
        const paymentLocals: PsiloPaymentLocals = {
          buyerAddress,
          routePath: pathname,
          route,
          verification,
          ...(seller !== undefined ? { seller } : {}),
        };
        res.locals.psiloPayment = paymentLocals;
        next();
      } catch (err) {
        respondPaymentMiddlewareError(res, err, {
          pathname,
          method: req.method,
          route,
          buyerAddress,
          ...(seller !== undefined ? { seller } : {}),
        });
      }
    };
  };
}
