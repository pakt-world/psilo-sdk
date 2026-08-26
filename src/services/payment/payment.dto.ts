import { ResponseDto } from "../../utils/response";

export interface PaymentCoin {
  _id: string;
  name: string;
  symbol: string;
  icon?: string;
  reference?: string;
  priceTag?: string;
  /** Per-chain token contract addresses, keyed by chain ID. */
  contractAddresses?: Record<string, string>;
  /** Contract address resolved for `resolvedChainId`. */
  contractAddress?: string | null;
  decimal: string;
  /** Smallest amount this coin may be used for, in whole token units. */
  minAmount?: string;
  isToken: boolean;
  rpcChainIds: string[];
  active: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Chain this coin's `contractAddress` was resolved against. */
  resolvedChainId?: string;
}

export interface RpcNativeCurrency {
  name: string;
  symbol: string;
  decimals: string;
}

export interface ActiveRpc {
  _id: string;
  rpcName: string;
  rpcChainId: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  rpcNativeCurrency: RpcNativeCurrency;
  rpcType: string;
  rpcIcon?: string;
  active: boolean;
  factoryAddress?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** A chain new escrows may be created on. */
export interface AvailableChain {
  rpcServerId: string;
  chainId: string;
  name: string | null;
  rpcType: string | null;
  icon: string | null;
  nativeCurrency: RpcNativeCurrency | null;
  blockExplorerUrls: string[];
  rpcUrls: string[];
  factoryAddress: string | null;
  /** True for the chain used when a request sends no `chainId`. */
  isDefault: boolean;
}

export interface FetchPaymentCoinsQuery {
  /**
   * Chain to list coins for. This is the only filter the backend currently
   * reads (`GET /v1/payment/coins?chainId=`) — defaults to the default escrow
   * chain when omitted.
   */
  chainId?: string;
  /**
   * Filter coins to those belonging to this RPC server (AvailableChain.rpcServerId).
   * Not yet honoured by the backend — sent for forward compatibility.
   */
  rpcId?: string;
}

export interface PaymentModuleType {
  fetchPaymentCoins(query?: FetchPaymentCoinsQuery): Promise<ResponseDto<PaymentCoin[]>>;
  fetchActiveRpc(): Promise<ResponseDto<ActiveRpc | null>>;
  fetchAvailableChains(): Promise<ResponseDto<AvailableChain[]>>;
}
