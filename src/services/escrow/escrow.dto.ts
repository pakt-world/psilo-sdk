import { ResponseDto } from "../../utils/response";

export interface EscrowModuleType {
  create(data: CreateEscrowDto): Promise<ResponseDto<CreateEscrowResponse>>;
  getStatus(chainId: string, escrowAddress: string): Promise<ResponseDto<EscrowStatusResponse>>;
  release(chainId: string, escrowAddress: string, data?: ReleaseDto): Promise<ResponseDto<ReleaseResponse>>;
  updateStatus(data: UpdateEscrowStatusDto): Promise<ResponseDto<PrepareTransactionResponse>>;
  getChains(): Promise<ResponseDto<GetEscrowChainsResponseDto>>;
  getAssets(chainId: string): Promise<ResponseDto<GetEscrowAssetsResponseDto>>;
}

export interface EscrowWebhookConfigDto {
  webhookUrl: string;
  webHookType: "a2a" | "json";
}

export interface CreateEscrowDto {
  chainId: string;
  buyer: string;
  seller: string;
  creator?: string;
  title: string;
  description?: string;
  amount: string;
  asset: string;
  expiration?: string;
  releaseType?: string;
  webhookUrls?: EscrowWebhookConfigDto;
}

export interface CreateEscrowResponse {
  buyerWallet: string;
  sellerWallet: string;
  arbiterWallet: string;
  title: string;
  description: string | null;
  amount: number | string;
  expiration: string;
  releaseType: number | string;
  metadataHash: string;
  chainId: string | null;
  onChain: {
    txHash: string;
    escrowAddress: string;
    approve: {
      to: string;
      data: string;
      value: string;
    } | null;
    deposit: {
      to: string;
      data: string;
      value: string;
    };
  };
}

export interface EscrowStatusResponse {
  chainId: string;
  escrow: string;
  buyer: string;
  seller: string;
  arbiter: string;
  deposited: boolean;
  released: boolean;
  readyForRelease: boolean;
  buyerReleaseReady: boolean;
  balance: string;
}

export interface DepositDto {
  from: string;
}

export interface DepositResponse {
  transactionHash: string;
  blockNumber: number;
  deposited: boolean;
  balance: string;
}

export interface SignReleaseDto {
  signerAddress: string;
  privateKey?: string;
}

export interface SignReleaseResponse {
  signature: string;
  messageHash: string;
  signer: string;
  isShardholder: boolean;
  shardRole: string;
}

export interface ReleaseDto {
  recipient?: string;
}

export interface ReleaseResponse {
  success: boolean;
  txHash: string;
  escrowAddress: string;
  arbiter: string;
}

export interface UpdateEscrowStatusDto {
  chainId: string;
  escrow: string;
  address?: string;
  webhookUrl?: string;
}

export interface PrepareTransactionResponse {
  to: string;
  data: string;
  value: string;
  chainId: string;
  gas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  type: string;
  instructions: string;
  seller?: string;
  buyer?: string;
  nonce?: string;
}


export interface EscrowNativeCurrencyDto {
  name: string;
  symbol: string;
  decimals: number;
}

export interface EscrowChainDto {
  chainId: string;
  name: string;
  network: string;
  nativeCurrency: EscrowNativeCurrencyDto;
}

export interface GetEscrowChainsResponseDto {
  chains: EscrowChainDto[];
}

export interface EscrowAssetDto {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
}

export interface GetEscrowAssetsResponseDto {
  chainId: string;
  assets: EscrowAssetDto[];
}
