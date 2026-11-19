// Job Terms v1 EIP-712 signing and verification.
//
// The wallet shows the title, price and deadline next to the hash. The verifier rebuilds the message
// from the canonical terms, so the readable fields cannot differ from what is hashed.
import { Interface, TypedDataEncoder, recoverAddress, type Provider, type TypedDataDomain } from "ethers";
import { canonicalizeJobTerms, hashCanonical, jcs, parseTerms, type JobTermsInput } from "./hash";

export const JOB_TERMS_DOMAIN_NAME = "Pakt Job Terms";
export const JOB_TERMS_TYPES = {
  JobTerms: [
    { name: "title", type: "string" },
    { name: "amount", type: "uint256" },
    { name: "token", type: "address" },
    { name: "decimals", type: "uint8" },
    { name: "deadline", type: "uint64" },
    { name: "metadataHash", type: "bytes32" },
    { name: "escrow", type: "address" },
  ],
};

/** Anything with ethers' signTypedData: Wallet, HDNodeWallet, JsonRpcSigner. */
export interface TypedDataSigner {
  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, { name: string; type: string }[]>,
    value: Record<string, any>,
  ): Promise<string>;
}

export function jobTermsDomain(chainId: bigint | number, escrow: string): TypedDataDomain {
  return { name: JOB_TERMS_DOMAIN_NAME, version: "1", chainId, verifyingContract: escrow };
}

/** The message from a stored canonical string; refuses a string that is not exactly canonical. */
export function jobTermsMessage(canonical: string, escrow: string) {
  const t = parseTerms(canonical) as any;
  if (jcs(t) !== canonical) throw new Error("stored terms are not canonical");
  return {
    title: t.title as string,
    amount: BigInt(t.price.amount),
    token: t.price.token as string,
    decimals: t.price.decimals as number,
    deadline: BigInt(t.deadline),
    metadataHash: hashCanonical(canonical),
    escrow,
  };
}

/** Domain, types and message for any terms, validated first. The chain is the terms' price.chainId. */
export function jobTermsTypedData(terms: JobTermsInput, escrow: string) {
  const canonical = canonicalizeJobTerms(terms);
  const chainId = (parseTerms(canonical) as any).price.chainId as number;
  return {
    canonical,
    domain: jobTermsDomain(chainId, escrow),
    types: JOB_TERMS_TYPES,
    message: jobTermsMessage(canonical, escrow),
  };
}

/** The EIP-712 digest a signature covers. */
export function jobTermsDigest(terms: JobTermsInput, escrow: string): string {
  const { domain, types, message } = jobTermsTypedData(terms, escrow);
  return TypedDataEncoder.hash(domain, types, message);
}

/**
 * Sign the terms for one escrow. The terms are validated first, so incomplete terms are never signed.
 * Seller: sign at accept. Buyer: sign only when someone else created the escrow (the funding tx
 * is the buyer's signature otherwise).
 */
export async function signJobTerms(terms: JobTermsInput, signer: TypedDataSigner, escrow: string): Promise<string> {
  const { domain, types, message } = jobTermsTypedData(terms, escrow);
  return signer.signTypedData(domain, types, message);
}

const ERC1271 = new Interface(["function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)"]);
const ERC1271_MAGIC = "0x1626ba7e";

/** EOA signatures by ecrecover; contract wallets (code at `signer`) by ERC-1271. */
export async function verifyJobTermsSignature(args: {
  provider: Pick<Provider, "getCode" | "call">;
  chainId: bigint | number;
  escrow: string;
  terms: JobTermsInput;
  signer: string;
  signature: string;
}): Promise<{ ok: boolean; method: "eip712" | "erc1271" }> {
  const { provider, chainId, escrow, terms, signer, signature } = args;
  const canonical = canonicalizeJobTerms(terms);
  const t = parseTerms(canonical) as any;
  if (BigInt(t.price.chainId) !== BigInt(chainId)) return { ok: false, method: "eip712" };
  const digest = TypedDataEncoder.hash(
    jobTermsDomain(chainId, escrow),
    JOB_TERMS_TYPES,
    jobTermsMessage(canonical, escrow),
  );
  const code = (await provider.getCode(signer)) ?? "0x";
  // An EIP-7702 delegated EOA has code 0xef0100 + 20-byte address but still holds its key: try
  // ecrecover first, then ERC-1271 against the delegate.
  if (/^0xef0100[0-9a-fA-F]{40}$/.test(code)) {
    try {
      if (recoverAddress(digest, signature).toLowerCase() === signer.toLowerCase())
        return { ok: true, method: "eip712" };
    } catch (e) {
      // fall through to ERC-1271
    }
  }
  if (code !== "0x") {
    try {
      const ret = await provider.call({
        to: signer,
        data: ERC1271.encodeFunctionData("isValidSignature", [digest, signature]),
      });
      return { ok: ret.slice(0, 10).toLowerCase() === ERC1271_MAGIC, method: "erc1271" };
    } catch (e) {
      return { ok: false, method: "erc1271" };
    }
  }
  try {
    return { ok: recoverAddress(digest, signature).toLowerCase() === signer.toLowerCase(), method: "eip712" };
  } catch (e) {
    return { ok: false, method: "eip712" };
  }
}
