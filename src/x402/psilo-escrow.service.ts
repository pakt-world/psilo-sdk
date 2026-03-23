import type { CreateEscrowResponse, EscrowModuleType, ReleaseResponse } from "../services/escrow/escrow.dto";
import type { ResponseDto } from "../utils/response";
import { Status } from "../utils/response";
import type { X402EscrowPaymentStatus } from "./x402-escrow.types";

const META_SCHEMA = "psilo-x402-escrow-payment/v1";

export interface CreateX402EscrowParams {
  buyer: string;
  seller: string;
  /** Server-controlled amount (never trust the client). */
  amount: number | string;
  /** Token contract address passed to Psilo `asset`. */
  token: string;
  chainId: string;
  requestHash: string;
  title?: string;
  /** Human-readable symbol for 402 payloads (e.g. USDC). */
  tokenSymbol?: string;
  /** Escrow TTL; default 15 minutes. */
  expiresInMs?: number;
}

export interface CreateX402EscrowResult {
  escrowId: string;
  address: string;
  expiresAt: string;
  chainId: string;
  asset: string;
  amount: number;
  tokenSymbol: string;
  /** Psilo create `data` (same as `sdk.escrow.create` success `data`). */
  escrowDetails: CreateEscrowResponse;
}

interface EscrowPaymentRecord {
  requestHash: string;
  chainId: string;
  escrowAddress: string;
  buyer: string;
  seller: string;
  amountStr: string;
  asset: string;
  tokenSymbol: string;
  createdAt: number;
  expiresAt: number;
  escrowDetails: CreateEscrowResponse;
}

export function encodeX402EscrowId(chainId: string, escrowAddress: string): string {
  return `${chainId}:${escrowAddress}`;
}

export function parseX402EscrowId(escrowId: string): { chainId: string; address: string } | null {
  const idx = escrowId.indexOf(":");
  if (idx <= 0 || idx === escrowId.length - 1) return null;
  const chainId = escrowId.slice(0, idx).trim();
  const address = escrowId.slice(idx + 1).trim();
  if (!chainId || !address) return null;
  return { chainId, address };
}

function recordKey(chainId: string, addressLower: string): string {
  return `${chainId}:${addressLower.toLowerCase()}`;
}

function mapPsiloStatusToPaymentStatus(
  deposited: boolean,
  released: boolean,
  balance: string,
): X402EscrowPaymentStatus {
  if (released) return "RELEASED";
  const bal = balance.trim();
  if (deposited) {
    if (/^\d+$/.test(bal)) {
      try {
        if (BigInt(bal) > BigInt(0)) return "FUNDED";
      } catch {
        /* fall through */
      }
    }
    const n = parseFloat(bal);
    if (Number.isFinite(n) && n > 0) return "FUNDED";
  }
  return "AWAITING_FUNDS";
}

/**
 * Wraps Psilo escrow APIs for the x402 “pre-create → fund → retry with id” flow.
 * Keeps an in-memory index for {@link requestHash} validation (Psilo status API does not return description).
 */
export class X402PsiloEscrowService {
  private readonly byRequestHash = new Map<string, EscrowPaymentRecord>();
  private readonly byEscrowKey = new Map<string, EscrowPaymentRecord>();

  constructor(private readonly escrow: EscrowModuleType) {}

  private purgeRecord(rec: EscrowPaymentRecord): void {
    this.byRequestHash.delete(rec.requestHash);
    this.byEscrowKey.delete(recordKey(rec.chainId, rec.escrowAddress));
  }

  private purgeExpiredForHash(requestHash: string): void {
    const existing = this.byRequestHash.get(requestHash);
    if (existing && Date.now() > existing.expiresAt) {
      this.purgeRecord(existing);
    }
  }

  /**
   * Idempotent: same `requestHash` returns the same open escrow until expiry or release.
   */
  async createEscrow(params: CreateX402EscrowParams): Promise<CreateX402EscrowResult> {
    const ttl = params.expiresInMs ?? 15 * 60 * 1000;
    const now = Date.now();
    this.purgeExpiredForHash(params.requestHash);

    const existing = this.byRequestHash.get(params.requestHash);
    if (existing && now <= existing.expiresAt) {
      const st = await this.escrow.getStatus(existing.chainId, existing.escrowAddress);
      if (st.status === Status.SUCCESS && st.data) {
        const ps = mapPsiloStatusToPaymentStatus(st.data.deposited, st.data.released, st.data.balance);
        if (ps !== "RELEASED") {
          return {
            escrowId: encodeX402EscrowId(existing.chainId, existing.escrowAddress),
            address: existing.escrowAddress,
            expiresAt: new Date(existing.expiresAt).toISOString(),
            chainId: existing.chainId,
            asset: existing.asset,
            amount: parseFloat(existing.amountStr) || Number(existing.amountStr) || 0,
            tokenSymbol: existing.tokenSymbol,
            escrowDetails: existing.escrowDetails,
          };
        }
      }
      this.purgeRecord(existing);
    }

    const amountStr = typeof params.amount === "number" ? String(params.amount) : params.amount.trim();
    const expiresAtMs = now + ttl;
    const expiresIso = new Date(expiresAtMs).toISOString();
    const description = JSON.stringify({
      schema: META_SCHEMA,
      requestHash: params.requestHash,
      expiresAt: expiresIso,
    });

    const createRes = await this.escrow.create({
      chainId: params.chainId,
      buyer: params.buyer,
      seller: params.seller,
      title: params.title ?? `x402 ${params.requestHash.slice(0, 12)}`,
      description,
      amount: amountStr,
      asset: params.token,
      expiration: expiresIso,
    });

    if (createRes.status !== Status.SUCCESS || !createRes.data?.onChain?.escrowAddress) {
      const msg = createRes.message ? String(createRes.message) : "Escrow create failed";
      throw new Error(msg);
    }

    const address = createRes.data.onChain.escrowAddress;
    const details = createRes.data;
    const tokenSymbol = params.tokenSymbol ?? "TOKEN";
    const rec: EscrowPaymentRecord = {
      requestHash: params.requestHash,
      chainId: params.chainId,
      escrowAddress: address,
      buyer: params.buyer,
      seller: params.seller,
      amountStr,
      asset: params.token,
      tokenSymbol,
      createdAt: now,
      expiresAt: expiresAtMs,
      escrowDetails: details,
    };

    this.byRequestHash.set(params.requestHash, rec);
    this.byEscrowKey.set(recordKey(params.chainId, address), rec);

    return {
      escrowId: encodeX402EscrowId(params.chainId, address),
      address,
      expiresAt: expiresIso,
      chainId: params.chainId,
      asset: params.token,
      amount: parseFloat(amountStr) || Number(amountStr) || 0,
      tokenSymbol,
      escrowDetails: details,
    };
  }

  async getEscrow(escrowId: string): Promise<{
    id: string;
    status: X402EscrowPaymentStatus;
    amount: number;
    record: EscrowPaymentRecord;
  } | null> {
    const parsed = parseX402EscrowId(escrowId);
    if (!parsed) return null;
    const rec = this.byEscrowKey.get(recordKey(parsed.chainId, parsed.address));
    if (!rec) return null;
    if (Date.now() > rec.expiresAt) {
      this.purgeRecord(rec);
      return null;
    }

    const st = await this.escrow.getStatus(parsed.chainId, parsed.address);
    if (st.status !== Status.SUCCESS || !st.data) {
      return null;
    }

    const status = mapPsiloStatusToPaymentStatus(st.data.deposited, st.data.released, st.data.balance);
    const amount = parseFloat(st.data.balance) || parseFloat(rec.amountStr) || 0;

    return {
      id: escrowId,
      status,
      amount,
      record: rec,
    };
  }

  async releaseEscrow(escrowId: string, release?: { recipient?: string }): Promise<ResponseDto<ReleaseResponse>> {
    const parsed = parseX402EscrowId(escrowId);
    if (!parsed) {
      throw new Error("Invalid escrow id");
    }
    return this.escrow.release(parsed.chainId, parsed.address, release?.recipient ? { recipient: release.recipient } : undefined);
  }
}
