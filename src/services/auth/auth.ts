import { Container, Service } from "typedi";
import { Wallet } from "ethers";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto } from "../../utils/response";
import {
  AuthModuleType,
  NonceDto,
  NonceResponse,
  RegisterDto,
  RegisterResponse,
  VerifyDto,
  VerifyResponse,
  PaktWeb3RequestResponse,
  PaktWeb3ValidateResponse,
  PaktWeb3OnboardResponse,
} from "./auth.dto";

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

  /**
   * Authenticate an agent with paktsuite using its Ethereum private key.
   *
   * Flow:
   *   1. request  — server issues a one-time challenge message
   *   2. sign     — agent signs the message with its private key
   *   3. validate — server recovers the signer address and issues a JWT
   *
   * On first run the server returns an onboard token instead of a JWT.
   * The method handles onboarding automatically (using the wallet address
   * as firstName, lastName, and email) then re-authenticates to get the JWT.
   *
   * @param privateKey  Hex private key (with or without 0x prefix)
   * @returns           Paktsuite JWT ready for socket.io auth
   */
  public async paktWeb3Login(privateKey: string): Promise<string> {
    const wallet = new Wallet(privateKey);
    const address = wallet.address;

    const { message, tempToken: challengeToken } =
      await this._paktWeb3Request(address);

    const signedMessage = await wallet.signMessage(message);
    const validateResult = await this._paktWeb3Validate(signedMessage, challengeToken);

    if (validateResult.token) {
      return validateResult.token;
    }

    // First login — onboard with wallet address as profile, then re-authenticate
    if (!validateResult.tempToken) {
      throw new Error("Unexpected paktsuite web3/validate response: no token or tempToken");
    }

    await this._paktWeb3Onboard(validateResult.tempToken, address);

    const { message: msg2, tempToken: challengeToken2 } =
      await this._paktWeb3Request(address);

    const signedMessage2 = await wallet.signMessage(msg2);
    const finalResult = await this._paktWeb3Validate(signedMessage2, challengeToken2);

    if (!finalResult.token) {
      throw new Error("Web3 authentication failed after onboarding");
    }

    return finalResult.token;
  }

  /**
   * Generate a fresh Ethereum wallet and return its private key and address.
   * The caller is responsible for persisting the private key to WALLET.md.
   */
  public static generateWallet(): { privateKey: string; address: string } {
    const wallet = Wallet.createRandom();
    return { privateKey: wallet.privateKey, address: wallet.address };
  }

  private async _paktWeb3Request(account: string): Promise<PaktWeb3RequestResponse> {
    const raw = await this.connector.post<any>("/v1/auth/web3/request", { account });
    // Response shape: { message, data: { tempToken: { token, ... } } }
    return {
      message: raw.data.message,
      tempToken: raw.data.tempToken.token,
    };
  }

  private async _paktWeb3Validate(
    signedMessage: string,
    tempToken: string
  ): Promise<PaktWeb3ValidateResponse> {
    const raw = await this.connector.post<any>("/v1/auth/web3/validate", { signedMessage, tempToken });
    // Response shape: { status, data: { token, ... } } (onboarded) or { status, data: { account, tempToken: { token } } }
    const d = raw.data ?? raw;
    return {
      token: d?.token,
      token_type: d?.token_type,
      expiresIn: d?.expiresIn,
      isVerified: d?.isVerified,
      timeZone: d?.timeZone,
      account: d?.account,
      tempToken: d?.tempToken?.token ?? d?.tempToken,
    };
  }

  private async _paktWeb3Onboard(
    tempToken: string,
    address: string
  ): Promise<PaktWeb3OnboardResponse> {
    return this.connector.post<PaktWeb3OnboardResponse>(
      "/v1/auth/web3/onboard",
      {
        tempToken,
        firstName: address,
        lastName: address,
        email: `${address.toLowerCase()}@pakt.internal`,
      }
    );
  }
}
