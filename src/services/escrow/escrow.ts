import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto, Status, parseUrlWithQuery } from "../../utils/response";
import {
  CreateEscrowDto,
  CreateEscrowResponse,
  ComputeAddressParams,
  ComputeAddressResponse,
  EscrowStatusResponse,
  DepositDto,
  DepositResponse,
  SignReleaseDto,
  SignReleaseResponse,
  ReleaseDto,
  ReleaseResponse,
  ListEscrowsParams,
  ListEscrowsResponse,
  EscrowModuleType,
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
      const response = await this.connector.post<StandardResponse<CreateEscrowResponse>>("/mcp/escrow/create", data);
      // Assuming StandardResponse maps cleanly to ResponseDto's data property or you can transform as needed
      return response as unknown as ResponseDto<CreateEscrowResponse>; 
    });
  }

  public async computeAddress(params: ComputeAddressParams): Promise<ResponseDto<ComputeAddressResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const fetchUrl = parseUrlWithQuery("/mcp/escrow/compute-address", params);
      const response = await this.connector.get<StandardResponse<ComputeAddressResponse>>(fetchUrl);
      return response as unknown as ResponseDto<ComputeAddressResponse>;
    });
  }

  public async getStatus(address: string): Promise<ResponseDto<EscrowStatusResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<EscrowStatusResponse>>(`/mcp/escrow/${address}/status`);
      return response as unknown as ResponseDto<EscrowStatusResponse>;
    });
  }

  public async deposit(address: string, data: DepositDto): Promise<ResponseDto<DepositResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<DepositResponse>>(`/mcp/escrow/${address}/deposit`, data);
      return response as unknown as ResponseDto<DepositResponse>;
    });
  }

  public async signRelease(address: string, data: SignReleaseDto): Promise<ResponseDto<SignReleaseResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<SignReleaseResponse>>(`/mcp/escrow/${address}/sign-release`, data);
      return response as unknown as ResponseDto<SignReleaseResponse>;
    });
  }

  public async release(address: string, data: ReleaseDto): Promise<ResponseDto<ReleaseResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<ReleaseResponse>>(`/mcp/escrow/${address}/release`, data);
      return response as unknown as ResponseDto<ReleaseResponse>;
    });
  }

  public async list(params?: ListEscrowsParams): Promise<ResponseDto<ListEscrowsResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const fetchUrl = params ? parseUrlWithQuery("/mcp/escrows", params) : "/mcp/escrows";
      const response = await this.connector.get<StandardResponse<ListEscrowsResponse>>(fetchUrl);
      return response as unknown as ResponseDto<ListEscrowsResponse>;
    });
  }
}
