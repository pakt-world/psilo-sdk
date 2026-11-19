// Terms attestation. Reads the escrow's metadataHash AT A STATED BLOCK and reports whether it equals the
// hash of the terms. Anyone holding the escrow address can rerun it against any RPC and must get a
// byte-identical attestation, because every field is read at that block.
import { Interface, keccak256, toUtf8Bytes, type Provider } from "ethers";
import { canonicalizeJobTerms, hashCanonical, jcs, parseTerms, type JobTermsInput } from "./hash";

const FACTORY = new Interface(["function isEscrow(address) view returns (bool)"]);
const WALLET = new Interface([
  "function metadataHash() view returns (bytes32)",
  "function factory() view returns (address)",
]);

export type AttestProvider = Pick<Provider, "getBlock" | "getCode" | "call" | "getNetwork">;

export interface TermsAttestation {
  schema: "pakt.terms-attestation/1";
  chainId: number;
  blockNumber: number;
  blockHash: string;
  onChainMetadataHash: string;
  termsKeccak256: string;
  match: boolean;
}

/**
 * The factory is required: an escrow is only trusted when the known Psilo factory says it created it
 * (factory.isEscrow(escrow) at that block). The chain must be the terms' price.chainId.
 * Throws when the block does not exist, when there is no contract at the escrow address at that block,
 * when the factory does not vouch for the escrow, or when the chain is not the terms' chain.
 * A hash mismatch is not a throw: it is reported as match:false, which excludes the terms.
 */
export async function attestEscrowTerms(args: {
  provider: AttestProvider;
  escrow: string;
  blockNumber: number;
  terms: JobTermsInput;
  factory: string;
}): Promise<{ attestation: TermsAttestation; attestationKeccak256: string }> {
  const { provider, escrow, blockNumber, terms, factory } = args;
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(factory ?? ""))) throw new Error("the Psilo factory address is required");
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) {
    throw new Error("blockNumber must be a block number, never a tag like 'latest'");
  }
  const canonical = canonicalizeJobTerms(terms);
  const block = await provider.getBlock(blockNumber);
  if (!block || block.hash == null) throw new Error(`block ${blockNumber} not found`);
  const code = await provider.getCode(escrow, blockNumber);
  if (!code || code === "0x") throw new Error(`no escrow contract at block ${blockNumber}`);
  const read = async (fn: "metadataHash" | "factory") =>
    WALLET.decodeFunctionResult(
      fn,
      await provider.call({ to: escrow, data: WALLET.encodeFunctionData(fn), blockTag: blockNumber }),
    )[0];
  const vouched = FACTORY.decodeFunctionResult(
    "isEscrow",
    await provider.call({ to: factory, data: FACTORY.encodeFunctionData("isEscrow", [escrow]), blockTag: blockNumber }),
  )[0];
  if (vouched !== true) throw new Error("the factory does not list this escrow (factory.isEscrow is false)");
  const f = String(await read("factory")).toLowerCase();
  if (f !== factory.toLowerCase()) throw new Error("escrow was not created by the expected factory");
  const chainId = Number((await provider.getNetwork()).chainId);
  const termsChain = Number((parseTerms(canonical) as any)?.price?.chainId);
  if (chainId !== termsChain) throw new Error(`chain ${chainId} is not the terms' chain ${termsChain}`);
  const onChain = String(await read("metadataHash")).toLowerCase();
  const termsKeccak256 = hashCanonical(canonical);
  const attestation: TermsAttestation = {
    schema: "pakt.terms-attestation/1",
    chainId,
    blockNumber,
    blockHash: block.hash.toLowerCase(),
    onChainMetadataHash: onChain,
    termsKeccak256,
    match: onChain === termsKeccak256,
  };
  return { attestation, attestationKeccak256: keccak256(toUtf8Bytes(jcs(attestation))) };
}
