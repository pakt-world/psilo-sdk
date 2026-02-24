import { ResponseDto } from "../../utils/response";

export interface EscrowModuleType {
  create(data: CreateEscrowDto): Promise<ResponseDto<CreateEscrowResponse>>;
  computeAddress(params: ComputeAddressParams): Promise<ResponseDto<ComputeAddressResponse>>;
  getStatus(address: string): Promise<ResponseDto<EscrowStatusResponse>>;
  deposit(address: string, data: DepositDto): Promise<ResponseDto<DepositResponse>>;
  signRelease(address: string, data: SignReleaseDto): Promise<ResponseDto<SignReleaseResponse>>;
  release(address: string, data: ReleaseDto): Promise<ResponseDto<ReleaseResponse>>;
  list(params?: ListEscrowsParams): Promise<ResponseDto<ListEscrowsResponse>>;
}

export interface CreateEscrowDto {
  sender: string;
  receiver: string;
  asset: string;
  amount: string;
  originator: string;
  salt: string;
  metadataHash?: string;
}

export interface CreateEscrowResponse {
  escrowAddress: string;
  shardTokenAddress?: string;
  shardHolders?: {
    sender: string;
    receiver: string;
    guardian: string;
  };
  config?: {
    asset: string;
    amount: string;
    feeBps: number;
    feePercentage: string;
  };
  transactionHash?: string;
  blockNumber?: number;
}

export interface ComputeAddressParams {
  sender: string;
  receiver: string;
  asset: string;
  amount: string;
  originator: string;
  salt: string;
  metadataHash?: string;
}

export interface ComputeAddressResponse {
  predictedAddress: string;
  exists: boolean;
}

export interface EscrowStatusResponse {
  escrowAddress: string;
  deposited: boolean;
  released: boolean;
  balance: string;
  balanceFormatted?: string;
  config?: {
    sender: string;
    receiver: string;
    originator: string;
    asset: string;
    amount: string;
    feeBps: number;
  };
  shardToken?: string;
  nonce?: number;
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
  signatures: string[];
  executor: string;
}

export interface ReleaseResponse {
  transactionHash: string;
  blockNumber: number;
  released: boolean;
  payout: string;
  payoutFormatted?: string;
  fee: string;
  feeFormatted?: string;
  paktRewards?: {
    sender: string;
    receiver: string;
    originator: string;
    treasury: string;
  };
}

export interface ListEscrowsParams {
  sender?: string;
  receiver?: string;
  status?: "pending" | "deposited" | "released";
  page?: number;
  limit?: number;
}

export interface EscrowListItem {
  address: string;
  sender: string;
  receiver: string;
  asset: string;
  amount: string;
  deposited: boolean;
  released: boolean;
  createdAt: string;
}

export interface ListEscrowsResponse {
  total: number;
  page: number;
  limit: number;
  escrows: EscrowListItem[];
}
