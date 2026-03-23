import type { ConnectStyleResponse } from "./middleware";
import { X402PsiloEscrowService } from "./psilo-escrow.service";
import { PsiloX402Wrapper, type PsiloX402Host } from "./wrapper";
import {
  createX402EscrowMiddleware,
  getX402EscrowContext,
  X402_ESCROW_LOCALS_KEY,
  type X402EscrowMiddlewareOptions,
} from "./x402-escrow.middleware";
import type { X402EscrowRequestContext } from "./x402-escrow.types";

/**
 * x402 + Psilo flows namespaced on {@link PsiloSDK}. Use {@link PsiloSDK.paymentMiddleware} for proof/balance gating;
 * use {@link PsiloX402Module.createEscrowMiddleware} for the pre-create escrow + `x402-escrow-id` retry flow.
 */
export class PsiloX402Module {
  private _wrapper: PsiloX402Wrapper | undefined;
  private _escrowPayment: X402PsiloEscrowService | undefined;

  constructor(private readonly host: PsiloX402Host) {}

  get wrapper(): PsiloX402Wrapper {
    return (this._wrapper ??= new PsiloX402Wrapper(this.host));
  }

  /** Service for x402 escrow pre-create, status, and release (in-memory idempotency by `requestHash`). */
  get escrowPayment(): X402PsiloEscrowService {
    return (this._escrowPayment ??= new X402PsiloEscrowService(this.host.escrow));
  }

  /** Express/Connect middleware: 402 with escrow funding instructions until funded + hash/buyer checks pass. */
  createEscrowMiddleware(options: X402EscrowMiddlewareOptions) {
    return createX402EscrowMiddleware(this.escrowPayment, options);
  }

  /** Key on `res.locals` where {@link createEscrowMiddleware} stores {@link X402EscrowRequestContext}. */
  readonly escrowLocalsKey = X402_ESCROW_LOCALS_KEY;

  /** Read escrow context after middleware calls `next()`. */
  getEscrowRequestContext(res: ConnectStyleResponse): X402EscrowRequestContext | undefined {
    return getX402EscrowContext(res);
  }
}
