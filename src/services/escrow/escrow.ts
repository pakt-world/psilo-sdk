import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto, parseUrlWithQuery } from "../../utils/response";
import {
  CreateEscrowDto,
  CreateEscrowResponse,
  EscrowStatusResponse,
  ReleaseDto,
  ReleaseResponse,
  UpdateEscrowStatusDto,
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

  public async updateStatus(data: UpdateEscrowStatusDto): Promise<ResponseDto<PrepareTransactionResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<PrepareTransactionResponse>>("/api/escrow/update", data);
      return response as unknown as ResponseDto<PrepareTransactionResponse>;
    });
  }

  public async release(chainId: string, escrowAddress: string, data?: ReleaseDto): Promise<ResponseDto<ReleaseResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const payload = { chainId, escrowAddress, ...(data || {}) };
      const response = await this.connector.post<StandardResponse<ReleaseResponse>>("/api/escrow/release", payload);
      return response as unknown as ResponseDto<ReleaseResponse>;
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
