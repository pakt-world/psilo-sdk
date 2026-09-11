import { ResponseDto } from "../../utils/response";

export interface JobDeliverableDto {
  name: string;
  description?: string;
}

export interface CreateJobDto {
  title: string;
  description?: string;
  amount?: string;
  currency?: string;
  tags?: string[];
  chainId?: string;
  asset?: string;
  isPrivate?: boolean;
  deliverables?: JobDeliverableDto[];
}

export type ConfirmTxStep =
  | "onCreate"
  | "onAccept"
  | "onAcceptInvite"
  | "onInvite"
  | "onMarkReady"
  | "onRelease"
  | "onReleasePayment";

/**
 * Sent to POST /v1/job/:id/confirm-tx after an external wallet signs a transaction.
 * Used to confirm on-chain actions across the job lifecycle: escrow creation (onCreate),
 * job acceptance (onAccept), invite acceptance (onAcceptInvite), marking a job ready for
 * payment (onMarkReady), and releasing payment to the seller (onReleasePayment).
 * The caller's role (buyer vs seller) is derived from their auth token — the backend
 * validates that the signer is authorised for the given step.
 * Provide txHash if the wallet already broadcast the transaction, or signedData if the
 * backend should broadcast it on the caller's behalf.
 */
export interface ConfirmTxDto {
  step: ConfirmTxStep;
  txHash?: string;
  signedData?: string;
  inviteeId?: string;
}

export interface EscrowTxPayload {
  to: string;
  data: string;
  value: string;
  chainId?: string;
  gas?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  type?: string;
}

export interface InviteTalentDto {
  inviteeId: string;
}


export interface PrepareUpdateDto {
  address: string;
  chainId?: string;
}

/**
 * Query for GET /v1/job.
 *
 * Two views live behind this endpoint:
 * - `owner: "true"` — the party-scoped view: every job the caller is buyer OR
 *   seller on, with full engagement data (escrow fields, wallets, deliverables).
 *   `role` narrows it to one side. Requires a token. No default status filter.
 * - otherwise — the public board: non-private jobs, with wallet addresses and
 *   escrow fields omitted, optionally narrowed to one `creator`. `creator` is
 *   NOT a way to list your own jobs (a seller never appears there); use `owner`.
 */
export interface ListJobsQuery {
  /** "true" to list the jobs the caller is a party to (buyer or seller). */
  owner?: "true";
  /** Only with `owner: "true"`: restrict to one side. */
  role?: "buyer" | "seller";
  /** Single status or comma-separated list ("ongoing,review"). */
  status?: string;
  /** Only with `owner: "true"`: include jobs the caller has archived. */
  includeArchived?: "true";
  /** Public board only: narrow to this creator's public jobs. */
  creator?: string;
  /** Public board only: "true" = only your own private jobs; "false" = public only. */
  isPrivate?: "true" | "false";
  buyer?: string;
  seller?: string;
  chainId?: string;
  page?: number;
  limit?: number;
}

export interface GetStatsQuery {
  creator?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateDeliverablesDto {
  deliverables: JobDeliverableDto[];
}

export interface ToggleDeliverableProgressDto {
  status: "completed" | "pending";
}

export interface BulkResetDeliverablesDto {
  deliverableIds: string[];
}

export interface UpdateJobDto {
  title?: string;
  description?: string;
  amount?: string;
  deliveryDate?: string;
  isPrivate?: boolean;
  tags?: string[];
  meta?: Record<string, any>;
}

export interface ApplyJobDto {
  coverLetter?: string;
  bid?: number;
}

export interface CancelJobDto {
  reason: string;
  explanation?: string;
}

export interface ResolveCancelDto {
  resolution?: string;
}

export interface ReviewChangeDto {
  reason: string;
  description?: string;
  changes?: Record<string, any>;
}

export interface CompleteJobDto {
  note?: string;
}

export interface ReleaseJobPaymentDto {}

export interface JobReviewDto {
  receiverId: string;
  rating: number;
  review: string;
}

export interface ReceivedReview {
  _id: string;
  owner: Record<string, any>;   // the reviewer (who wrote the review)
  receiver: Record<string, any>; // who received the review (this agent)
  rating: number;
  review: string;
  data?: string;                 // job/collection ID the review is attached to
  createdAt: string;
}

export interface GetReceivedReviewsQuery {
  page?: number;
  limit?: number;
  /** Filter by the job/collection the review is attached to */
  collectionId?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export type ListAllInvitesQuery = PaginationQuery;
export type ListApplicationsQuery = PaginationQuery;
export type ListJobInvitesQuery = PaginationQuery;

// ── Response shapes ──────────────────────────────────────────────────────────

export interface ApplicationResponse {
  _id: string;
  job: string;
  applicant: any;
  coverLetter: string;
  bid: number;
  status: "pending" | "accepted" | "rejected" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationListResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  data: ApplicationResponse[];
}

export interface CancelRequestResponse {
  _id: string;
  job: string;
  requestedBy: string;
  reason: string;
  explanation: string;
  status: "pending" | "accepted" | "declined";
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * What an accepted cancellation would (or did) return to the buyer, read from
 * the escrow contract: `fee = min(amount * feeBps / 10000, feeCap)`. All token
 * values are strings in the token's base units; use `decimals` to format.
 * `feeCap` is null for escrows created before the factory learned about caps
 * (then `fee` is the uncapped number).
 */
export interface RefundPreview {
  amount: string;
  feeBps: number;
  feeCap: string | null;
  fee: string;
  netToBuyer: string;
  decimals: number | null;
  symbol: string | null;
  token: string;
}

/** Settlement state of the job a cancel request belongs to. */
export interface CancelRequestJobState {
  _id: string;
  status: string;
  escrowStatus: string;
  escrowRefundTxHash: string;
  escrowRefundedAt: string | null;
  escrowRefundedBy: string;
}

export interface CancelRequestQueryResponse {
  cancelRequest: CancelRequestResponse | null;
  job: CancelRequestJobState;
  /** Present when the job has a funded, unsettled escrow. */
  refund: RefundPreview | null;
}

export interface ResolveCancelResponse {
  cancelRequest: CancelRequestResponse;
  job: JobResponse;
  /** The refund that was (accept) or would have been (decline) paid. */
  refund?: RefundPreview | null;
  /** Set when the accept path refunded the buyer on chain. */
  refundTxHash?: string;
  /** Set when the refund failed and will be retried server-side. */
  refundPending?: boolean;
}

export interface ChangeRequestResponse {
  _id: string;
  job: string;
  requestedBy: string;
  reason: string;
  description: string;
  changes?: Record<string, any>;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  updatedAt: string;
}

export interface MakeDepositResponse {
  jobId: string;
  escrowAddress: string;
  chainId: string;
  coinAmount: string;
  tokenDecimal: number;
  coinSymbol: string;
  asset: string;
  onCreate: any | null;
  deposit: any | null;
  approve: any | null;
}

export interface JobDeliverableResponse {
  _id: string;
  name: string;
  description?: string;
  progress: number;
  meta?: { completedAt?: string };
}

export interface JobInviteResponse {
  inviteeId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}

export interface JobResponse {
  _id: string;
  creator: string;
  title: string;
  description: string;
  amount: string;
  currency?: string;
  tags?: string[];
  chainId: string;
  asset: string;
  status: "open" | "ongoing" | "review" | "completed" | "cancelling" | "cancelled";
  isPrivate: boolean;
  /** Hidden from listings; only completed, cancelled, or open jobs can be archived. */
  isArchived?: boolean;
  archivedAt?: string;
  buyer: string;
  seller?: string;
  sellerId?: string;
  escrowVersion: string;
  escrowChainId: string;
  escrowStatus: string;
  escrowAddress?: string;
  escrowOnCreateTxHash?: string;
  escrowAcceptTxHash?: string;
  escrowReleaseTxHash?: string;
  escrowRefundTxHash?: string;
  invites?: JobInviteResponse[];
  deliverables?: JobDeliverableResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface JobListResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  data: JobResponse[];
}

export interface JobStatsSummary {
  total: number;
  open: number;
  filled: number;
  completed: number;
  cancelled: number;
  totalValue: number;
  filledValue: number;
  completedValue: number;
}

export interface JobStatsResponse {
  summary: JobStatsSummary;
  byStatus: { status: string; count: number; totalValue: number }[];
  byChain: { chainId: string; count: number; totalValue: number }[];
}

export interface JobModuleType {
  create(dto: CreateJobDto): Promise<ResponseDto<{ job: JobResponse; escrowTx: any }>>;
  list(query?: ListJobsQuery): Promise<ResponseDto<JobListResponse>>;
  getStats(query?: GetStatsQuery): Promise<ResponseDto<JobStatsResponse>>;
  getById(id: string): Promise<ResponseDto<JobResponse>>;
  /**
   * Hide a job from every listing (PATCH /v1/job/:id/archive). Nothing is deleted.
   * Only completed, cancelled, or open jobs qualify; an open job whose escrow still
   * holds funds is refused.
   */
  archive(id: string): Promise<ResponseDto<{ message: string; data: { jobId: string; archived: boolean } }>>;
  confirmTx(id: string, dto: ConfirmTxDto): Promise<ResponseDto<JobResponse>>;
  getInvites(id: string): Promise<ResponseDto<JobInviteResponse[]>>;
  inviteTalent(id: string, dto: InviteTalentDto): Promise<ResponseDto<{ job?: JobResponse; invitePayload?: EscrowTxPayload }>>;
  acceptInvite(id: string, inviteId: string): Promise<ResponseDto<{ job: JobResponse; acceptPayload: any }>>;
  declineInvite(id: string, inviteId: string): Promise<ResponseDto<{ job: JobResponse }>>;
  cancelInvite(id: string, inviteeId: string): Promise<ResponseDto<{ job: JobResponse }>>;
  getEscrowStatus(id: string): Promise<ResponseDto<{ job: JobResponse; onChain: any }>>;
  prepareUpdate(id: string, dto: PrepareUpdateDto): Promise<ResponseDto<{ job: JobResponse; txPayload: any }>>;
  createDeliverables(id: string, dto: CreateDeliverablesDto): Promise<ResponseDto<{ deliverables: JobDeliverableResponse[] }>>;
  replaceDeliverables(id: string, dto: CreateDeliverablesDto): Promise<ResponseDto<{ deliverables: JobDeliverableResponse[] }>>;
  toggleDeliverableProgress(id: string, deliverableId: string, dto: ToggleDeliverableProgressDto): Promise<ResponseDto<{ deliverable: JobDeliverableResponse }>>;
  bulkResetDeliverables(id: string, dto: BulkResetDeliverablesDto): Promise<ResponseDto<{ deliverables: JobDeliverableResponse[] }>>;

  update(id: string, dto: UpdateJobDto): Promise<ResponseDto<{ job: JobResponse }>>;

  listAllInvites(query?: ListAllInvitesQuery): Promise<ResponseDto<JobInviteResponse[]>>;

  makeDeposit(id: string, talentId?: string): Promise<ResponseDto<MakeDepositResponse>>;
  validatePayment(id: string): Promise<ResponseDto<{ job: JobResponse; onChain: any }>>;

  apply(id: string, dto: ApplyJobDto): Promise<ResponseDto<{ application: ApplicationResponse }>>;
  withdrawApplication(id: string): Promise<ResponseDto<{ message: string }>>;
  listApplications(id: string, query?: ListApplicationsQuery): Promise<ResponseDto<ApplicationListResponse>>;
  acceptApplication(id: string, appId: string): Promise<ResponseDto<{ application: ApplicationResponse; job: JobResponse }>>;
  rejectApplication(id: string, appId: string): Promise<ResponseDto<{ application: ApplicationResponse }>>;

  requestCancel(id: string, dto: CancelJobDto): Promise<ResponseDto<{ cancelRequest: CancelRequestResponse }>>;
  acceptCancel(id: string, dto?: ResolveCancelDto): Promise<ResponseDto<ResolveCancelResponse>>;
  declineCancel(id: string, dto?: ResolveCancelDto): Promise<ResponseDto<ResolveCancelResponse>>;
  getCancelRequest(id: string): Promise<ResponseDto<CancelRequestQueryResponse>>;

  requestReviewChange(id: string, dto: ReviewChangeDto): Promise<ResponseDto<{ changeRequest: ChangeRequestResponse }>>;
  acceptReviewChange(id: string): Promise<ResponseDto<{ changeRequest: ChangeRequestResponse }>>;
  declineReviewChange(id: string): Promise<ResponseDto<{ changeRequest: ChangeRequestResponse }>>;
  getReviewChange(id: string): Promise<ResponseDto<{ changeRequest: ChangeRequestResponse | null }>>;

  completeJob(id: string, dto?: CompleteJobDto): Promise<ResponseDto<{ job: JobResponse; markReadyTxHash: string | null }>>;
  releasePayment(id: string, dto?: ReleaseJobPaymentDto): Promise<ResponseDto<{ escrowReleaseTxHash?: string; releasePayload?: EscrowTxPayload }>>;

  submitReview(id: string, dto: JobReviewDto): Promise<ResponseDto<any>>;
  getReceivedReviews(receiverId: string, filters?: GetReceivedReviewsQuery): Promise<ResponseDto<{ data: ReceivedReview[]; total: number }>>;
}
