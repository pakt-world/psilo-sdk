import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto, parseUrlWithQuery } from "../../utils/response";
import {
  CreateEscrowDto,
  CreateEscrowResponse,
  EscrowStatusResponse,
  ReleaseResponse,
  ListEscrowsParams,
  ListEscrowsResponse,
  EscrowModuleType,
  PrepareTransactionResponse,
  GetEscrowChainsResponseDto,
  GetEscrowAssetsResponseDto
} from "./escrow.dto";

@Service({
  factory: (data: { id: string }) => {
    return new EscrowService(data.id);
  },
  transient: true,
})
export class EscrowService implements EscrowModuleType {
  private id: string;
  private connector: Connector;

  constructor(id: string) {
    this.id = id;
    this.connector = Container.of(this.id).get(Connector);
  }

  public async create(data: CreateEscrowDto): Promise<ResponseDto<CreateEscrowResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<CreateEscrowResponse>>("/api/escrow/create", data);
      return response as unknown as ResponseDto<CreateEscrowResponse>; 
    });
  }

  public async getStatus(chainId: string, escrowAddress: string): Promise<ResponseDto<EscrowStatusResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const fetchUrl = parseUrlWithQuery("/api/escrow/status", { chainId, escrow: escrowAddress });
      const response = await this.connector.get<StandardResponse<EscrowStatusResponse>>(fetchUrl);
      return response as unknown as ResponseDto<EscrowStatusResponse>;
    });
  }

  public async updateStatus(escrowAddress: string, data: { chainId: string; address: string }): Promise<ResponseDto<PrepareTransactionResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const payload = { ...data, escrow: escrowAddress };
      const response = await this.connector.post<StandardResponse<PrepareTransactionResponse>>("/api/escrow/update", payload);
      return response as unknown as ResponseDto<PrepareTransactionResponse>;
    });
  }

  public async prepareRelease(escrowAddress: string, recipient?: string): Promise<ResponseDto<PrepareTransactionResponse>> {
    return ErrorUtils.newTryFail(async () => {
      // Assuming a similar payload structure based on PrepareReleaseEscrowDto if the server exposed it, 
      // but the server's Controller indicates `/release` executes directly.
      // If there's a prepare endpoint for release we would call it here.
      // But based on controller, `/release` is `releaseEscrow` directly.
      // We will adjust if there's a specific prepare release endpoint or if direct release is intended.
      const payload = recipient ? { escrowAddress, recipient } : { escrowAddress };
      const response = await this.connector.post<StandardResponse<PrepareTransactionResponse>>("/api/escrow/prepare-release", payload);
      return response as unknown as ResponseDto<PrepareTransactionResponse>;
    });
  }

  public async release(escrowAddress: string, data?: { recipient?: string }): Promise<ResponseDto<ReleaseResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const payload = { escrowAddress, ...(data || {}) };
      const response = await this.connector.post<StandardResponse<ReleaseResponse>>("/api/escrow/release", payload);
      return response as unknown as ResponseDto<ReleaseResponse>;
    });
  }

  public async list(params?: ListEscrowsParams): Promise<ResponseDto<ListEscrowsResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const fetchUrl = params ? parseUrlWithQuery("/api/escrows", params) : "/api/escrows";
      const response = await this.connector.get<StandardResponse<ListEscrowsResponse>>(fetchUrl);
      return response as unknown as ResponseDto<ListEscrowsResponse>;
    });
  }

  public async getChains(): Promise<ResponseDto<GetEscrowChainsResponseDto>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<GetEscrowChainsResponseDto>>("/api/escrow/chains");
      return response as unknown as ResponseDto<GetEscrowChainsResponseDto>;
    });
  }

  public async getAssets(chainId: string): Promise<ResponseDto<GetEscrowAssetsResponseDto>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<GetEscrowAssetsResponseDto>>(`/api/escrow/assets/${chainId}`);
      return response as unknown as ResponseDto<GetEscrowAssetsResponseDto>;
    });
  }
}
