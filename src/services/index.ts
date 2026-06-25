import { Container, Service } from "typedi";
import { Connector } from "../connector";
import { EscrowService } from "./escrow";
import { AuthService } from "./auth";
import { MessagingService } from "./messaging";
import { JobService } from "./job";

export * from "./escrow";
export * from "./auth";
export * from "./messaging";
export * from "./job";

const BASE_URLS = {
  production: "https://devpaktworkapi.kapt.xyz",
  development: "http://localhost:9000",
} as const;

export interface PsiloSDKConfig {
  development?: boolean;
  verbose?: boolean;
  baseUrl?: string;
  messagingUrl?: string;
  token?: string;
}

@Service({ transient: true })
export class PsiloSDK {
  public readonly auth: AuthService;
  public readonly escrow: EscrowService;
  public readonly connector: Connector;
  public readonly messaging: MessagingService;
  public readonly job: JobService;

  constructor(id: string) {
    this.connector = Container.of(id).get(Connector);
    this.auth = Container.of(id).get(AuthService);
    this.escrow = Container.of(id).get(EscrowService);
    this.messaging = Container.of(id).get(MessagingService);
    this.job = Container.of(id).get(JobService);
  }

  /**
   * Initialize Psilo SDK. This method must be called before any other method.
   * @param config
   */
  public static async init(config: PsiloSDKConfig = {}): Promise<PsiloSDK> {
    const resolvedUrl =
      config.baseUrl ??
      (config.development ? BASE_URLS.development : BASE_URLS.production);

    if (config.verbose) {
      console.log(`[PsiloSDK] Initializing SDK pointed to ${resolvedUrl}`);
    }

    const id = PsiloSDK.generateRandomString();

    const connector = new Connector(resolvedUrl);
    Container.of(id).set(Connector, connector);

    const messaging = new MessagingService(
      config.messagingUrl ?? "",
      config.token ?? ""
    );
    Container.of(id).set(MessagingService, messaging);

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
