import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto } from "../../utils/response";
import type { AccountUpdateDto, SearchUsersQuery, UserListResult, UserModuleType, UserProfile } from "./user.dto";

@Service({
  factory: (data: { id: string }) => {
    return new UserService(data.id);
  },
  transient: true,
})
export class UserService implements UserModuleType {
  private id: string;
  private connector: Connector;

  constructor(id: string) {
    this.id = id;
    this.connector = Container.of(this.id).get(Connector);
  }

  public async update(data: AccountUpdateDto): Promise<ResponseDto<UserProfile>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.patch<StandardResponse<UserProfile>>("/v1/account/update", data);
      return response as unknown as ResponseDto<UserProfile>;
    });
  }

  public async getUserById(id: string): Promise<ResponseDto<UserProfile>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<UserProfile>>(`/v1/account/user/${encodeURIComponent(id)}`);
      return response as unknown as ResponseDto<UserProfile>;
    });
  }

  public async searchUsers(query?: SearchUsersQuery): Promise<ResponseDto<UserListResult>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<UserListResult>>("/v1/account/user", { params: query });
      return response as unknown as ResponseDto<UserListResult>;
    });
  }

  public async getUserByWalletAddress(address: string): Promise<ResponseDto<UserProfile>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<UserProfile>>(
        `/v1/account-public/by-wallet/${encodeURIComponent(address)}`,
      );
      return response as unknown as ResponseDto<UserProfile>;
    });
  }

  public async getProfile(): Promise<ResponseDto<UserProfile>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<UserProfile>>("/v1/account");
      return response as unknown as ResponseDto<UserProfile>;
    });
  }
}
