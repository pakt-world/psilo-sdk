import { Container, Service } from "typedi";
import { Connector } from "../connector";
import { EscrowService } from "./escrow";
import { AuthService } from "./auth";

export * from "./escrow";
export * from "./auth";

export interface PsiloSDKConfig {
  baseUrl?: string;
  verbose?: boolean;
}

@Service({ transient: true })
export class PsiloSDK {
  public readonly auth: AuthService;
  public readonly escrow: EscrowService;
  public readonly connector: Connector;

  constructor(id: string) {
    this.connector = Container.of(id).get(Connector);
    this.auth = Container.of(id).get(AuthService);
    this.escrow = Container.of(id).get(EscrowService);
  }

  /**
   * Initialize Psilo SDK. This method must be called before any other method.
   * @param config
   */
  public static async init(config: PsiloSDKConfig): Promise<PsiloSDK> {
    if (!config.baseUrl) {
      throw new Error("PsiloSDK initialization requires a valid baseUrl");
    }

    if (config.verbose) {
      console.log(`[PsiloSDK] Initializing SDK pointed to ${config.baseUrl}`);
    }

    const id = PsiloSDK.generateRandomString();
    
    // Set the specific connector instance for this SDK instance in DI
    const connector = new Connector(config.baseUrl);
    Container.of(id).set(Connector, connector);

    return new PsiloSDK(id);
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
