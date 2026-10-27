import { Container, Service } from "typedi";
import { Wallet } from "ethers";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto, RetryOptions, Status, parseUrlWithQuery, retryOnChainLag } from "../../utils/response";
import { SDKError } from "../../utils/errors";
import {
  AGENT_ACTION_DOMAIN_NAME,
  DEFAULT_SIGNING_CHAIN_ID,
  SigningDomain,
  signAgentAction,
} from "../../utils/agent-action";
import {
  IssueEvidenceResponse,
  IssueListResponse,
  IssueModuleType,
  IssueResponse,
  IssueStatementDto,
  JuryCommitResponse,
  JuryRevealDto,
  JuryRevealResponse,
  ListIssuesQuery,
  OpenIssueDto,
  OpenIssueResponse,
  SettlementPreviewResponse,
} from "./issue.dto";

const BASE = "/v1/job-issues";

/**
 * Sealed-panel issue resolution (paktsuite `/v1/job-issues`). Every write is signed with the
 * agent's wallet (EIP-712 AgentAction) on top of the JWT, so call `useSigner()` with the same
 * key the session logged in with before any write. Reads need only the JWT.
 */
@Service({
  factory: (data: { id: string }) => {
    return new IssueService(data.id);
  },
  transient: true,
})
export class IssueService implements IssueModuleType {
  private id: string;
  private connector: Connector;
  private wallet?: Wallet;
  private domain?: SigningDomain;

  constructor(id: string) {
    this.id = id;
    this.connector = Container.of(this.id).get(Connector);
  }

  public useSigner(privateKey: string): void {
    this.wallet = new Wallet(privateKey);
  }

  /** The domain this server verifies against. Older servers have no route: their default is 8453. */
  public async signingDomain(): Promise<ResponseDto<SigningDomain>> {
    if (this.domain) return { status: Status.SUCCESS, data: this.domain };
    try {
      const response = await this.connector.get<StandardResponse<SigningDomain>>(`${BASE}/signing-domain`);
      const data = (response as unknown as ResponseDto<SigningDomain>).data;
      if (data?.chainId) this.domain = data;
    } catch (error) {
      if (!(error instanceof SDKError) || error.status !== 404) throw error;
    }
    this.domain ??= { name: AGENT_ACTION_DOMAIN_NAME, version: "1", chainId: DEFAULT_SIGNING_CHAIN_ID };
    return { status: Status.SUCCESS, data: this.domain };
  }

  public async open(dto: OpenIssueDto): Promise<ResponseDto<OpenIssueResponse>> {
    return this.signedPost<OpenIssueResponse>(BASE, "", dto);
  }

  /**
   * After broadcasting raiseDispute(). Retries through RPC lag: the API reads `disputed()` from
   * the escrow and refuses until its node has the block.
   */
  public async confirmOpen(
    id: string,
    txHash?: string,
    retry?: Pick<RetryOptions, "onRetry">,
  ): Promise<ResponseDto<{ issue: IssueResponse }>> {
    return retryOnChainLag(
      () => this.signedPost<{ issue: IssueResponse }>(`${BASE}/${id}/confirm-open`, id, txHash ? { txHash } : {}),
      { onRetry: retry?.onRetry },
    );
  }

  public async withdraw(id: string): Promise<ResponseDto<{ issue: IssueResponse }>> {
    return this.signedPost(`${BASE}/${id}/withdraw`, id, {});
  }

  public async defend(id: string, dto: IssueStatementDto): Promise<ResponseDto<{ issue: IssueResponse }>> {
    return this.signedPost(`${BASE}/${id}/defense`, id, dto);
  }

  public async get(id: string): Promise<ResponseDto<IssueResponse>> {
    return this.read<IssueResponse>(`${BASE}/${id}`);
  }

  public async list(query: ListIssuesQuery = {}): Promise<ResponseDto<IssueListResponse>> {
    return this.read<IssueListResponse>(parseUrlWithQuery(BASE, query));
  }

  public async settlementPreview(id: string): Promise<ResponseDto<SettlementPreviewResponse>> {
    return this.read<SettlementPreviewResponse>(`${BASE}/${id}/settlement-preview`);
  }

  public async evidence(id: string): Promise<ResponseDto<IssueEvidenceResponse>> {
    return this.read<IssueEvidenceResponse>(`${BASE}/${id}/evidence`);
  }

  public async juryAccept(id: string): Promise<ResponseDto<{ issue: IssueResponse }>> {
    return this.signedPost(`${BASE}/${id}/jury/accept`, id, {});
  }

  public async juryDecline(id: string): Promise<ResponseDto<{ declined: boolean }>> {
    return this.signedPost(`${BASE}/${id}/jury/decline`, id, {});
  }

  public async juryCommit(id: string, commitment: string): Promise<ResponseDto<JuryCommitResponse>> {
    return this.signedPost(`${BASE}/${id}/jury/commit`, id, { commitment });
  }

  public async juryReveal(id: string, dto: JuryRevealDto): Promise<ResponseDto<JuryRevealResponse>> {
    return this.signedPost(`${BASE}/${id}/jury/reveal`, id, dto);
  }

  private async read<T>(url: string): Promise<ResponseDto<T>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<T>>(url);
      return response as unknown as ResponseDto<T>;
    });
  }

  /**
   * Signs inside the retried call: each attempt carries a fresh nonce, since the server spends
   * a nonce on first use and would reject a replayed one.
   */
  private async signedPost<T>(path: string, subject: string, body: object): Promise<ResponseDto<T>> {
    if (!this.wallet) {
      return {
        status: Status.ERROR,
        message: "issue: call useSigner(privateKey) before a signed request",
        data: undefined as unknown as T,
      };
    }
    const wallet = this.wallet;
    return ErrorUtils.newTryFail(async () => {
      const domain = (await this.signingDomain()).data;
      const headers = await signAgentAction(wallet, domain, { method: "POST", path, subject, body });
      const response = await this.connector.post<StandardResponse<T>>(path, body, { headers });
      return response as unknown as ResponseDto<T>;
    });
  }
}
