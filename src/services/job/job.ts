import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto, parseUrlWithQuery } from "../../utils/response";
import {
  JobModuleType,
  CreateJobDto,
  ConfirmTxDto,
  InviteTalentDto,
  PrepareUpdateDto,
  ListJobsQuery,
  GetStatsQuery,
  CreateDeliverablesDto,
  ToggleDeliverableProgressDto,
  BulkResetDeliverablesDto,
  JobResponse,
  JobListResponse,
  JobStatsResponse,
  JobInviteResponse,
  JobDeliverableResponse,
  UpdateJobDto,
  ListAllInvitesQuery,
  MakeDepositResponse,
  ApplyJobDto,
  ApplicationResponse,
  ApplicationListResponse,
  ListApplicationsQuery,
  CancelJobDto,
  CancelRequestResponse,
  ResolveCancelDto,
  ReviewChangeDto,
  ChangeRequestResponse,
  CompleteJobDto,
  ReleaseJobPaymentDto,
  JobReviewDto,
} from "./job.dto";

@Service({
  factory: (data: { id: string }) => {
    return new JobService(data.id);
  },
  transient: true,
})
export class JobService implements JobModuleType {
  private id: string;
  private connector: Connector;

  constructor(id: string) {
    this.id = id;
    this.connector = Container.of(this.id).get(Connector);
  }

  public async create(dto: CreateJobDto): Promise<ResponseDto<{ job: JobResponse; escrowTx: any }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ job: JobResponse; escrowTx: any }>>("/v1/job", dto);
      return response as unknown as ResponseDto<{ job: JobResponse; escrowTx: any }>;
    });
  }

  public async list(query: ListJobsQuery = {}): Promise<ResponseDto<JobListResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const url = parseUrlWithQuery("/v1/job", query);
      const response = await this.connector.get<StandardResponse<JobListResponse>>(url);
      return response as unknown as ResponseDto<JobListResponse>;
    });
  }

  public async getStats(query: GetStatsQuery = {}): Promise<ResponseDto<JobStatsResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const url = parseUrlWithQuery("/v1/job/stats", query);
      const response = await this.connector.get<StandardResponse<JobStatsResponse>>(url);
      return response as unknown as ResponseDto<JobStatsResponse>;
    });
  }

  public async getById(id: string): Promise<ResponseDto<{ job: JobResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<{ job: JobResponse }>>(`/v1/job/${id}`);
      return response as unknown as ResponseDto<{ job: JobResponse }>;
    });
  }

  public async delete(id: string): Promise<ResponseDto<{ message: string }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.delete<StandardResponse<{ message: string }>>(`/v1/job/${id}`);
      return response as unknown as ResponseDto<{ message: string }>;
    });
  }

  public async confirmTx(id: string, dto: ConfirmTxDto): Promise<ResponseDto<JobResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<JobResponse>>(`/v1/job/${id}/confirm-tx`, dto);
      return response as unknown as ResponseDto<JobResponse>;
    });
  }

  public async getInvites(id: string): Promise<ResponseDto<JobInviteResponse[]>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<JobInviteResponse[]>>(`/v1/job/${id}/invites`);
      return response as unknown as ResponseDto<JobInviteResponse[]>;
    });
  }

  public async inviteTalent(id: string, dto: InviteTalentDto): Promise<ResponseDto<JobResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<JobResponse>>(`/v1/job/${id}/invite`, dto);
      return response as unknown as ResponseDto<JobResponse>;
    });
  }

  public async acceptInvite(id: string, inviteId: string): Promise<ResponseDto<{ job: JobResponse; acceptPayload: any }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ job: JobResponse; acceptPayload: any }>>(`/v1/job/${id}/invite/${inviteId}/accept`);
      return response as unknown as ResponseDto<{ job: JobResponse; acceptPayload: any }>;
    });
  }

  public async declineInvite(id: string, inviteId: string): Promise<ResponseDto<{ job: JobResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ job: JobResponse }>>(`/v1/job/${id}/invite/${inviteId}/decline`);
      return response as unknown as ResponseDto<{ job: JobResponse }>;
    });
  }

  public async cancelInvite(id: string, inviteeId: string): Promise<ResponseDto<{ job: JobResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.delete<StandardResponse<{ job: JobResponse }>>(`/v1/job/${id}/invite/${inviteeId}`);
      return response as unknown as ResponseDto<{ job: JobResponse }>;
    });
  }

  public async getEscrowStatus(id: string): Promise<ResponseDto<{ job: JobResponse; onChain: any }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<{ job: JobResponse; onChain: any }>>(`/v1/job/${id}/escrow/status`);
      return response as unknown as ResponseDto<{ job: JobResponse; onChain: any }>;
    });
  }

  public async prepareUpdate(id: string, dto: PrepareUpdateDto): Promise<ResponseDto<{ job: JobResponse; txPayload: any }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ job: JobResponse; txPayload: any }>>(`/v1/job/${id}/escrow/update`, dto);
      return response as unknown as ResponseDto<{ job: JobResponse; txPayload: any }>;
    });
  }

  public async createDeliverables(id: string, dto: CreateDeliverablesDto): Promise<ResponseDto<{ deliverables: JobDeliverableResponse[] }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ deliverables: JobDeliverableResponse[] }>>(`/v1/job/${id}/deliverables`, dto);
      return response as unknown as ResponseDto<{ deliverables: JobDeliverableResponse[] }>;
    });
  }

  public async replaceDeliverables(id: string, dto: CreateDeliverablesDto): Promise<ResponseDto<{ deliverables: JobDeliverableResponse[] }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.put<StandardResponse<{ deliverables: JobDeliverableResponse[] }>>(`/v1/job/${id}/deliverables`, dto);
      return response as unknown as ResponseDto<{ deliverables: JobDeliverableResponse[] }>;
    });
  }

  public async toggleDeliverableProgress(
    id: string,
    deliverableId: string,
    dto: ToggleDeliverableProgressDto
  ): Promise<ResponseDto<{ deliverable: JobDeliverableResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.patch<StandardResponse<{ deliverable: JobDeliverableResponse }>>(
        `/v1/job/${id}/deliverables/${deliverableId}`,
        dto
      );
      return response as unknown as ResponseDto<{ deliverable: JobDeliverableResponse }>;
    });
  }

  public async bulkResetDeliverables(id: string, dto: BulkResetDeliverablesDto): Promise<ResponseDto<{ deliverables: JobDeliverableResponse[] }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.patch<StandardResponse<{ deliverables: JobDeliverableResponse[] }>>(
        `/v1/job/${id}/deliverables/bulk`,
        dto
      );
      return response as unknown as ResponseDto<{ deliverables: JobDeliverableResponse[] }>;
    });
  }

  public async update(id: string, dto: UpdateJobDto): Promise<ResponseDto<{ job: JobResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.patch<StandardResponse<{ job: JobResponse }>>(`/v1/job/${id}`, dto);
      return response as unknown as ResponseDto<{ job: JobResponse }>;
    });
  }

  public async listAllInvites(query: ListAllInvitesQuery = {}): Promise<ResponseDto<JobInviteResponse[]>> {
    return ErrorUtils.newTryFail(async () => {
      const url = parseUrlWithQuery("/v1/job/invites", query);
      const response = await this.connector.get<StandardResponse<JobInviteResponse[]>>(url);
      return response as unknown as ResponseDto<JobInviteResponse[]>;
    });
  }

  public async makeDeposit(id: string, talentId?: string): Promise<ResponseDto<MakeDepositResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const url = parseUrlWithQuery(`/v1/job/${id}/make-deposit`, { talentId });
      const response = await this.connector.get<StandardResponse<MakeDepositResponse>>(url);
      return response as unknown as ResponseDto<MakeDepositResponse>;
    });
  }

  public async validatePayment(id: string): Promise<ResponseDto<{ job: JobResponse; onChain: any }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ job: JobResponse; onChain: any }>>(`/v1/job/${id}/payment/validate`);
      return response as unknown as ResponseDto<{ job: JobResponse; onChain: any }>;
    });
  }

  public async apply(id: string, dto: ApplyJobDto): Promise<ResponseDto<{ application: ApplicationResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ application: ApplicationResponse }>>(`/v1/job/${id}/apply`, dto);
      return response as unknown as ResponseDto<{ application: ApplicationResponse }>;
    });
  }

  public async withdrawApplication(id: string): Promise<ResponseDto<{ message: string }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.delete<StandardResponse<{ message: string }>>(`/v1/job/${id}/apply`);
      return response as unknown as ResponseDto<{ message: string }>;
    });
  }

  public async listApplications(id: string, query: ListApplicationsQuery = {}): Promise<ResponseDto<ApplicationListResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const url = parseUrlWithQuery(`/v1/job/${id}/applications`, query);
      const response = await this.connector.get<StandardResponse<ApplicationListResponse>>(url);
      return response as unknown as ResponseDto<ApplicationListResponse>;
    });
  }

  public async acceptApplication(id: string, appId: string): Promise<ResponseDto<{ application: ApplicationResponse; job: JobResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ application: ApplicationResponse; job: JobResponse }>>(
        `/v1/job/${id}/applications/${appId}/accept`
      );
      return response as unknown as ResponseDto<{ application: ApplicationResponse; job: JobResponse }>;
    });
  }

  public async rejectApplication(id: string, appId: string): Promise<ResponseDto<{ application: ApplicationResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ application: ApplicationResponse }>>(
        `/v1/job/${id}/applications/${appId}/reject`
      );
      return response as unknown as ResponseDto<{ application: ApplicationResponse }>;
    });
  }

  public async requestCancel(id: string, dto: CancelJobDto): Promise<ResponseDto<{ cancelRequest: CancelRequestResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ cancelRequest: CancelRequestResponse }>>(`/v1/job/${id}/cancel`, dto);
      return response as unknown as ResponseDto<{ cancelRequest: CancelRequestResponse }>;
    });
  }

  public async acceptCancel(id: string, dto?: ResolveCancelDto): Promise<ResponseDto<{ cancelRequest: CancelRequestResponse; job: JobResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ cancelRequest: CancelRequestResponse; job: JobResponse }>>(
        `/v1/job/${id}/cancel/accept`,
        dto ?? {}
      );
      return response as unknown as ResponseDto<{ cancelRequest: CancelRequestResponse; job: JobResponse }>;
    });
  }

  public async declineCancel(id: string, dto?: ResolveCancelDto): Promise<ResponseDto<{ cancelRequest: CancelRequestResponse; job: JobResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ cancelRequest: CancelRequestResponse; job: JobResponse }>>(
        `/v1/job/${id}/cancel/decline`,
        dto ?? {}
      );
      return response as unknown as ResponseDto<{ cancelRequest: CancelRequestResponse; job: JobResponse }>;
    });
  }

  public async getCancelRequest(id: string): Promise<ResponseDto<{ cancelRequest: CancelRequestResponse | null }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<{ cancelRequest: CancelRequestResponse | null }>>(`/v1/job/${id}/cancel`);
      return response as unknown as ResponseDto<{ cancelRequest: CancelRequestResponse | null }>;
    });
  }

  public async requestReviewChange(id: string, dto: ReviewChangeDto): Promise<ResponseDto<{ changeRequest: ChangeRequestResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ changeRequest: ChangeRequestResponse }>>(`/v1/job/${id}/review-change`, dto);
      return response as unknown as ResponseDto<{ changeRequest: ChangeRequestResponse }>;
    });
  }

  public async acceptReviewChange(id: string): Promise<ResponseDto<{ changeRequest: ChangeRequestResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ changeRequest: ChangeRequestResponse }>>(`/v1/job/${id}/review-change/accept`);
      return response as unknown as ResponseDto<{ changeRequest: ChangeRequestResponse }>;
    });
  }

  public async declineReviewChange(id: string): Promise<ResponseDto<{ changeRequest: ChangeRequestResponse }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ changeRequest: ChangeRequestResponse }>>(`/v1/job/${id}/review-change/decline`);
      return response as unknown as ResponseDto<{ changeRequest: ChangeRequestResponse }>;
    });
  }

  public async getReviewChange(id: string): Promise<ResponseDto<{ changeRequest: ChangeRequestResponse | null }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<{ changeRequest: ChangeRequestResponse | null }>>(`/v1/job/${id}/review-change`);
      return response as unknown as ResponseDto<{ changeRequest: ChangeRequestResponse | null }>;
    });
  }

  public async completeJob(id: string, dto?: CompleteJobDto): Promise<ResponseDto<{ job: JobResponse; markReadyTxHash: string | null }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ job: JobResponse; markReadyTxHash: string | null }>>(
        `/v1/job/${id}/complete`,
        dto ?? {}
      );
      return response as unknown as ResponseDto<{ job: JobResponse; markReadyTxHash: string | null }>;
    });
  }

  public async releasePayment(id: string, dto?: ReleaseJobPaymentDto): Promise<ResponseDto<{ escrowReleaseTxHash: string | null }>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<{ escrowReleaseTxHash: string | null }>>(
        `/v1/job/${id}/release`,
        dto ?? {}
      );
      return response as unknown as ResponseDto<{ escrowReleaseTxHash: string | null }>;
    });
  }

  public async submitReview(id: string, dto: JobReviewDto): Promise<ResponseDto<any>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.post<StandardResponse<any>>(`/v1/job/${id}/review`, dto);
      return response as unknown as ResponseDto<any>;
    });
  }
}
