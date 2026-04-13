import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto } from "../../utils/response";
import { AuthModuleType, NonceDto, NonceResponse, RegisterDto, RegisterResponse, VerifyDto, VerifyResponse } from "./auth.dto";

@Service({
  factory: (data: { id: string }) => {
    return new AuthService(data.id);
  },
  transient: true,
})
export class AuthService implements AuthModuleType {
  private id: string;
  private connector: Connector;

  constructor(id: string) {
    this.id = id;
    this.connector = Container.of(this.id).get(Connector);
  }

  public async register(data: RegisterDto): Promise<ResponseDto<RegisterResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<RegisterResponse>>("/api/auth/register", data);
      return response as unknown as ResponseDto<RegisterResponse>;
    });
  }

  public async nonce(data: NonceDto): Promise<ResponseDto<NonceResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<NonceResponse>>("/api/auth/nonce", data);
      return response as unknown as ResponseDto<NonceResponse>;
    });
  }

  public async verify(data: VerifyDto): Promise<ResponseDto<VerifyResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<VerifyResponse>>("/api/auth/verify", data);
      return response as unknown as ResponseDto<VerifyResponse>;
    });
  }
}
