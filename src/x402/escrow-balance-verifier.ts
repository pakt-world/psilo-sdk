import type { PsiloSDK } from "../services";
import { Status } from "../utils/response";
import type { X402PaymentProof, X402PaymentVerifier, X402VerificationContext, X402VerificationResult } from "./types";

const ESCROW_ADDR_KEYS = ["escrowAddress", "escrow", "escrowContract"] as const;
const CHAIN_KEYS = ["chainId", "chain"] as const;

function proofString(proof: X402PaymentProof, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = proof[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/** Compare on-chain / API balance string to expected route amount (integer wei or decimal strings). */
export function escrowBalanceMeetsExpected(escrowBalance: string, expectedAmount: string): boolean {
  const b = escrowBalance.trim();
  const e = expectedAmount.trim();
  if (e === "" || e === "0") {
    if (/^\d+$/.test(b)) return BigInt(b) > BigInt(0);
    const n = parseFloat(b);
    return Number.isFinite(n) && n > 0;
  }
  const bDigits = /^\d+$/.test(b);
  const eDigits = /^\d+$/.test(e);
  if (bDigits && eDigits) {
    return BigInt(b) >= BigInt(e);
  }
  const bn = parseFloat(b);
  const en = parseFloat(e);
  return Number.isFinite(bn) && Number.isFinite(en) && bn >= en - Number.EPSILON;
}

function addressesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Verifies an x402-style payment by loading Psilo escrow status and checking deposit, balance, and optional parties.
 *
 * **Proof** (typical JSON in `x-payment-proof` header) should include:
 * - `escrowAddress` or `escrow` — contract to check
 * - `chainId` or `chain` — optional if the route already supplies `context.chainId`
 * - `payer` or `buyer` — optional; if present, must match escrow `buyer`
 */
export async function verifyX402PaymentWithEscrowBalance(
  sdk: PsiloSDK,
  proof: X402PaymentProof,
  context?: X402VerificationContext,
): Promise<X402VerificationResult> {
  const escrowAddress = proofString(proof, ESCROW_ADDR_KEYS);
  const chainId = proofString(proof, CHAIN_KEYS) ?? context?.chainId;

  if (!escrowAddress) {
    return { valid: false, reason: "Missing escrow address in payment proof", details: { hint: "Set escrowAddress or escrow" } };
  }
  if (!chainId) {
    return { valid: false, reason: "Missing chain id in payment proof or route context", details: { hint: "Set chainId or chain" } };
  }

  const statusRes = await sdk.escrow.getStatus(chainId, escrowAddress);
  if (statusRes.status !== Status.SUCCESS || !statusRes.data) {
    return {
      valid: false,
      reason: "Could not load escrow status",
      details: { message: statusRes.message, code: statusRes.code },
    };
  }

  const st = statusRes.data;
  if (!st.deposited) {
    return { valid: false, reason: "Escrow has no deposit", details: { escrow: st.escrow } };
  }
  if (st.released) {
    return { valid: false, reason: "Escrow already released", details: { escrow: st.escrow } };
  }

  if (context?.payTo !== undefined && context.payTo.length > 0) {
    if (!addressesEqual(st.seller, context.payTo)) {
      return {
        valid: false,
        reason: "Escrow seller does not match expected payee",
        details: { expected: context.payTo, actual: st.seller },
      };
    }
  }

  const proofPayer = proofString(proof, ["payer", "buyer"]);
  if (proofPayer !== undefined && proofPayer.length > 0) {
    if (!addressesEqual(st.buyer, proofPayer)) {
      return {
        valid: false,
        reason: "Proof payer does not match escrow buyer",
        details: { expectedBuyer: proofPayer, escrowBuyer: st.buyer },
      };
    }
  }

  if (context?.expectedAmount !== undefined && context.expectedAmount !== "") {
    if (!escrowBalanceMeetsExpected(st.balance, context.expectedAmount)) {
      return {
        valid: false,
        reason: "Escrow balance does not meet required amount",
        details: { balance: st.balance, expectedAmount: context.expectedAmount },
      };
    }
  }

  return {
    valid: true,
    payer: st.buyer,
    amount: st.balance,
    token: context?.asset,
    raw: { escrow: st.escrow, chainId: st.chainId, deposited: st.deposited, balance: st.balance },
  };
}

/** {@link X402PaymentVerifier} that uses {@link verifyX402PaymentWithEscrowBalance}. */
export function createEscrowBalanceX402Verifier(sdk: PsiloSDK): X402PaymentVerifier {
  return {
    verify(input): Promise<X402VerificationResult> {
      return verifyX402PaymentWithEscrowBalance(sdk, input.proof, input.context);
    },
  };
}
