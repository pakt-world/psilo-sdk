import { Container, Service } from "typedi";
import { Connector } from "../connector";
import { resolvePsiloApiBaseUrl } from "../psilo-constants";
import type { PaymentMiddlewareFactory } from "../x402/payment-middleware-factory";
import { PsiloX402Module } from "../x402/psilo-x402-module";
import type { PsiloNetworkRegistry } from "../x402/network-registry";
import { EscrowService } from "./escrow";

export * from "./escrow";

export interface PsiloSDKConfig {
  baseUrl?: string;
  verbose?: boolean;
  /** When `true` and `baseUrl` is omitted, uses the SDK test Psilo API URL. */
  isTest?: boolean;
}

@Service({ transient: true })
export class PsiloSDK {
  public readonly escrow: EscrowService;
  public readonly connector: Connector;
  private _x402: PsiloX402Module | undefined;

  /**
   * Set by {@link PsiloSDK.init}. Route payment gate: `app.use(sdk.paymentMiddleware(buyer, routes))`.
   */
  public paymentMiddleware!: PaymentMiddlewareFactory;
  /**
   * Set by {@link PsiloSDK.init}. Chain list from the Psilo API (`getChains`).
   */
  public Network!: PsiloNetworkRegistry;

  constructor(id: string) {
    this.connector = Container.of(id).get(Connector);
    this.escrow = Container.of(id).get(EscrowService);
  }

  /**
   * x402 subsystem (verify + escrow helpers). Route payment gate: {@link PsiloSDK.paymentMiddleware}.
   */
  get x402(): PsiloX402Module {
    return (this._x402 ??= new PsiloX402Module(this));
  }

  /**
   * Initialize Psilo SDK. This method must be called before any other method.
   * @param config
   */
  public static async init(config: PsiloSDKConfig): Promise<PsiloSDK> {
    const baseUrl = resolvePsiloApiBaseUrl(config);

    if (config.verbose) {
      console.log(`[PsiloSDK] Initializing SDK pointed to ${baseUrl}`);
    }

    const id = PsiloSDK.generateRandomString();

    const connector = new Connector(baseUrl);
    Container.of(id).set(Connector, connector);

    const sdk = new PsiloSDK(id);

    const [{ createPaymentMiddlewareFactory }, { buildPsiloNetworkRegistry }] = await Promise.all([
      import("../x402/payment-middleware-factory"),
      import("../x402/network-registry"),
    ]);

    sdk.Network = await buildPsiloNetworkRegistry(sdk);
    sdk.paymentMiddleware = createPaymentMiddlewareFactory(sdk);

    return sdk;
  }

  // Allow dynamic updating of headers if necessary (e.g. for Auth tokens down the line)
  public setAuthorizationHeader(token: string): void {
    this.connector.setHeader("Authorization", `Bearer ${token}`);
  }

  /**
   * Generate Random String. This method is used to generate random strings.
   */
  private static generateRandomString(): string {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 60; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
}

export default PsiloSDK;
