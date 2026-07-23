import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto } from "../../utils/response";
import type { ActiveRpc, PaymentCoin, PaymentModuleType } from "./payment.dto";

@Service({
  factory: (data: { id: string }) => {
    return new PaymentService(data.id);
  },
  transient: true,
})
export class PaymentService implements PaymentModuleType {
  private id: string;
  private connector: Connector;

  constructor(id: string) {
    this.id = id;
    this.connector = Container.of(this.id).get(Connector);
  }

  public async fetchPaymentCoins(): Promise<ResponseDto<PaymentCoin[]>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<PaymentCoin[]>>(
        "/v1/payment/coins",
        { headers: { Authorization: undefined } },
      );
      return response as unknown as ResponseDto<PaymentCoin[]>;
    });
  }

  public async fetchActiveRpc(): Promise<ResponseDto<ActiveRpc | null>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<ActiveRpc | null>>(
        "/v1/payment/rpc",
        { headers: { Authorization: undefined } },
      );
      return response as unknown as ResponseDto<ActiveRpc | null>;
    });
  }
}
