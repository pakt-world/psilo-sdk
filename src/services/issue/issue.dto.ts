import { ResponseDto } from "../../utils/response";
import { SigningDomain } from "../../utils/agent-action";
import { EscrowTxPayload } from "../job/job.dto";

export type Verdict = "plaintiff" | "defense";

/**
 * awaiting_onchain → submitted → in_review → pending_jury_verdicts → resolved.
 * `withdrawn` / `abandoned` end an issue whose raiseDispute() never landed.
 */
export type IssueStatus =
  | "awaiting_onchain"
  | "submitted"
  | "in_review"
  | "pending_jury_verdicts"
  | "resolved"
  | "withdrawn"
  | "abandoned";

export interface IssueModuleType {
  useSigner(privateKey: string): void;
  signingDomain(): Promise<ResponseDto<SigningDomain>>;
  open(dto: OpenIssueDto): Promise<ResponseDto<OpenIssueResponse>>;
  confirmOpen(id: string, txHash?: string): Promise<ResponseDto<{ issue: IssueResponse }>>;
  withdraw(id: string): Promise<ResponseDto<{ issue: IssueResponse }>>;
  defend(id: string, dto: IssueStatementDto): Promise<ResponseDto<{ issue: IssueResponse }>>;
  get(id: string): Promise<ResponseDto<IssueResponse>>;
  list(query?: ListIssuesQuery): Promise<ResponseDto<IssueListResponse>>;
  settlementPreview(id: string): Promise<ResponseDto<SettlementPreviewResponse>>;
  evidence(id: string): Promise<ResponseDto<IssueEvidenceResponse>>;
  juryAccept(id: string): Promise<ResponseDto<{ issue: IssueResponse }>>;
  juryDecline(id: string): Promise<ResponseDto<{ declined: boolean }>>;
  juryCommit(id: string, commitment: string): Promise<ResponseDto<JuryCommitResponse>>;
  juryReveal(id: string, dto: JuryRevealDto): Promise<ResponseDto<JuryRevealResponse>>;
}

// ── Request ───────────────────────────────────────────────────────────────────

export interface IssueStatementDto {
  title: string;
  content: string;
  /** Upload ids. */
  attachments?: string[];
}

export interface OpenIssueDto extends IssueStatementDto {
  jobId: string;
}

export interface ListIssuesQuery {
  page?: number;
  limit?: number;
}

export interface JuryRevealDto {
  verdict: Verdict;
  /** Hex sha256 of the rationale. */
  rationaleHash: string;
  jurorSalt: string;
  /** Checked against rationaleHash when sent. Stored on the issue; never written on chain. */
  rationale?: string;
}

// ── Response ──────────────────────────────────────────────────────────────────

export interface IssueStatement {
  title: string;
  content: string;
  attachments: string[];
}

export interface PanelSeatView {
  seat: number;
  isOverseer: boolean;
  /** Hidden from the parties. */
  jurorId?: string;
  seatedAt: string;
  verdictDeadline: string;
  committed: boolean;
  revealed: boolean;
  replaced: boolean;
  round: number;
  /** Your own seat's vote, or every vote once resolved. */
  verdict?: Verdict;
  rationale?: string;
  onTime?: boolean;
}

export interface PanelInviteView {
  userId: string;
  rank: number;
  invitedAt: string;
  status: "invited" | "accepted" | "declined" | "expired";
}

export interface IssueResponse {
  _id: string;
  job: string;
  escrowAddress: string;
  escrowChainId: string;
  plaintiff: string;
  defender: string;
  plaintiffRole: "buyer" | "seller";
  issue: IssueStatement;
  defense?: IssueStatement;
  defenseAt?: string;
  status: IssueStatus;
  raiseDisputeTxHash: string;
  seedSource: string;
  round: number;
  sealedAt?: string;
  panel: PanelSeatView[];
  /** Only your own invite; hidden from the parties. */
  invites?: PanelInviteView[];
  poolExhausted: boolean;
  verdict: Verdict | "";
  outcome: "plaintiff_won" | "defense_won" | "";
  decidedBy?: "panel" | "overseer_fallback" | "";
  resolvedAt?: string;
  settlement: {
    status: "pending" | "settled" | "failed";
    sellerBps?: number;
    jurors: string[];
    txHash: string;
    error: string;
    settledAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OpenIssueResponse {
  issue: IssueResponse;
  /** Web3 plaintiffs: sign and broadcast this, then confirmOpen(). */
  raiseDisputePayload?: EscrowTxPayload;
}

export interface IssueListResponse {
  data: IssueResponse[];
  total: number;
  page: number;
  limit: number;
}

/** Token base units, read from the escrow. */
export interface SettlementPreviewResponse {
  preview: {
    amount: string;
    disputeFee: string;
    winnerPayout: string;
    winnerRebate: string;
    jurorShareBps: number;
    jurorEach: string;
    jurorSeats: number;
    liquidity: string;
    generation: string;
  } | null;
  seatsAssumed: number;
}

export interface IssueEvidenceResponse {
  issueId: string;
  plaintiffRole: "buyer" | "seller";
  job: {
    id: string;
    title: string;
    description: string;
    amount: string;
    asset: string;
    statusBeforeDispute: string;
    deliverables: Array<{ description: string; status: string; comment: string; completedAt: string | null }>;
    completionNote: string;
  };
  plaintiff: IssueStatement;
  defense: IssueStatement;
  /** Parties named by role only. */
  chatHistory: Array<{ role: "Issuer" | "Defence"; content: string; at: string }>;
}

export interface JuryCommitResponse {
  committed: boolean;
  verdictDeadline: string;
}

export interface JuryRevealResponse {
  revealed: boolean;
  onTime: boolean;
  issueStatus: IssueStatus;
}
