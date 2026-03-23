import type { CreateEscrowResponse } from "../services/escrow/escrow.dto";

/** Logical escrow lifecycle for x402 payment gating (mapped from Psilo on-chain status). */
export type X402EscrowPaymentStatus = "AWAITING_FUNDS" | "FUNDED" | "RELEASED";

export interface X402EscrowPaymentRequiredBody {
  error: "Payment Required";
  payment: {
    type: "escrow";
    escrowId: string;
    escrowAddress: string;
    amount: number;
    token: string;
    expiresAt: string;
    chainId: string;
    asset: string;
    /** Psilo `escrow.create` `data` payload (`onChain`, wallets, title, …). */
    escrowDetails: CreateEscrowResponse;
  };
}

/** Set on `res.locals.x402Escrow` after successful funded verification. */
export interface X402EscrowRequestContext {
  id: string;
  chainId: string;
  escrowAddress: string;
  requestHash: string;
  buyer: string;
  seller: string;
  amount: string;
  asset: string;
  tokenSymbol: string;
}
