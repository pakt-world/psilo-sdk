import { ResponseDto } from "../../utils/response";

export interface PaymentCoin {
  _id: string;
  name: string;
  symbol: string;
  icon?: string;
  reference?: string;
  priceTag?: string;
  contractAddress?: string;
  decimal: string;
  isToken: boolean;
  rpcChainId: number;
  active: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
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

export interface PaymentModuleType {
  fetchPaymentCoins(): Promise<ResponseDto<PaymentCoin[]>>;
  fetchActiveRpc(): Promise<ResponseDto<ActiveRpc | null>>;
}
