import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto } from "../../utils/response";
import { AccountUpdateDto, UserModuleType, UserProfile } from "./user.dto";

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
}
