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
