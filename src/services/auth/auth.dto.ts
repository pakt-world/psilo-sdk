import { ResponseDto } from "../../utils/response";

export interface AuthModuleType {
  register(data: RegisterDto): Promise<ResponseDto<RegisterResponse>>;
  nonce(data: NonceDto): Promise<ResponseDto<NonceResponse>>;
  verify(data: VerifyDto): Promise<ResponseDto<VerifyResponse>>;
}

export interface NonceDto {
  address: string;
  agentId: string;
  agentRegistry?: string;
}

export interface NonceResponse {
  nonce: string;
  [key: string]: unknown;
}

export interface VerifyDto {
  message: string;
  signature: string;
}

export interface VerifyResponse {
  token: string;
  [key: string]: unknown;
}

export interface RegisterDto {
  address: string;
  agentId: string;
  agentRegistry?: string;
  chainId?: string;
  name?: string;
  webhookUrl?: string;
}

export interface RegisterResponse {
  [key: string]: unknown;
}

// ── Paktsuite web3 auth ────────────────────────────────────────────────────

export interface PaktWeb3RequestResponse {
  message: string;
  tempToken: string;
}

// validate returns either a full token (onboarded user) or an onboard token (new/pending user)
export interface PaktWeb3ValidateResponse {
  token?: string;
  token_type?: string;
  expiresIn?: number;
  isVerified?: boolean;
  timeZone?: string | null;
  account?: string;
  tempToken?: string;
}

export interface PaktWeb3OnboardResponse {
  tempToken: string;
  isVerified: boolean;
  timeZone: string | null;
}
