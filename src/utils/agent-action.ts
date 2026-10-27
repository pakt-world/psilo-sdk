import { BaseWallet, hexlify, keccak256, randomBytes, sha256, toUtf8Bytes } from "ethers";

/**
 * Agent-signed requests (paktsuite `AgentSignatureGuard`). Issue-resolution writes carry an
 * EIP-712 `AgentAction` over what they do, on top of the JWT:
 *
 *   headers  x-agent-signature, x-agent-nonce, x-agent-expiry
 *   domain   { name: "Pakt Issue Resolution", version: "1", chainId }   ← not the escrow chain
 *   message  { action: "<METHOD> <path>", subject: <:id or "">, bodyHash, nonce, expiry }
 *
 * `stableStringify` must produce the server's bytes exactly: keys sorted at every level,
 * `undefined` keys dropped. The vectors in agent-action.spec.ts pin it.
 */
export const AGENT_ACTION_DOMAIN_NAME = "Pakt Issue Resolution";
export const AGENT_ACTION_TYPES = {
  AgentAction: [
    { name: "action", type: "string" },
    { name: "subject", type: "string" },
    { name: "bodyHash", type: "bytes32" },
    { name: "nonce", type: "string" },
    { name: "expiry", type: "uint256" },
  ],
};

/** What a server without `GET /v1/job-issues/signing-domain` expects (its env default). */
export const DEFAULT_SIGNING_CHAIN_ID = 8453;

export interface SigningDomain {
  name: string;
  version: string;
  chainId: number;
  maxAgeMs?: number;
}

export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function agentBodyHash(body: unknown): string {
  return keccak256(toUtf8Bytes(stableStringify(body ?? {})));
}

/** Signs one request and returns the three headers to send with it. */
export async function signAgentAction(
  wallet: BaseWallet,
  domain: SigningDomain,
  req: { method: string; path: string; subject?: string; body?: unknown },
  ttlSeconds = 300,
): Promise<Record<string, string>> {
  const message = {
    action: `${req.method.toUpperCase()} ${req.path.split("?")[0]}`,
    subject: req.subject ?? "",
    bodyHash: agentBodyHash(req.body),
    nonce: hexlify(randomBytes(16)),
    expiry: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const signature = await wallet.signTypedData(
    { name: domain.name, version: domain.version, chainId: domain.chainId },
    AGENT_ACTION_TYPES,
    message,
  );
  return {
    "x-agent-signature": signature,
    "x-agent-nonce": message.nonce,
    "x-agent-expiry": String(message.expiry),
  };
}

/** Hex sha256 of a UTF-8 string, without 0x: the panel's hash format. */
export function sha256Hex(input: string): string {
  return sha256(toUtf8Bytes(input)).slice(2);
}

/** A juror's sealed vote: sha256(verdict:rationaleHash:jurorSalt). */
export function voteCommitment(verdict: string, rationaleHash: string, jurorSalt: string): string {
  return sha256Hex(`${verdict}:${rationaleHash}:${jurorSalt}`);
}

/** A fresh juror salt: 32 random bytes, hex. */
export function newJurorSalt(): string {
  return hexlify(randomBytes(32)).slice(2);
}
