import type { PsiloSDK } from "../services";
import type { EscrowChainDto } from "../services/escrow/escrow.dto";
import { Status } from "../utils/response";

export interface PsiloNetworkRegistry {
  /** Chains returned by the Psilo API (may be empty if the call failed). */
  chains: EscrowChainDto[];
  getChain(chainId: string): EscrowChainDto | undefined;
}

export async function buildPsiloNetworkRegistry(sdk: PsiloSDK): Promise<PsiloNetworkRegistry> {
  const res = await sdk.escrow.getChains();
  const chains = res.status === Status.SUCCESS && res.data?.chains?.length ? res.data.chains : [];
  const byId = new Map(chains.map((c) => [c.chainId, c]));
  return {
    chains,
    getChain(chainId: string) {
      return byId.get(chainId);
    },
  };
}
