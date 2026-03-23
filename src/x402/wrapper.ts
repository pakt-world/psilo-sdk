import type { CreateEscrowDto, EscrowModuleType, ReleaseDto } from "../services/escrow/escrow.dto";
import { X402PaymentRequiredError } from "./errors";
import type {
  JobExecutionMetadata,
  ReleaseEvaluationContext,
  X402EscrowCreateParams,
  X402FlowExecuteResult,
  X402PaymentProof,
  X402PaymentVerifier,
  X402ReleaseConditionEvaluator,
  X402ReleaseNotification,
  X402VerificationContext,
  X402VerificationResult,
  X402VerificationSuccess,
} from "./types";
import { serializeJobMetadataForEscrow } from "./types";

/** Minimal host for x402 flows — typically {@link PsiloSDK}. */
export interface PsiloX402Host {
  escrow: EscrowModuleType;
}

/**
 * Orchestrates the x402 → service → Psilo escrow → conditional release flow around a Psilo SDK instance.
 */
export class PsiloX402Wrapper {
  constructor(private readonly psilo: PsiloX402Host) {}

  /**
   * Step 1 — x402 payment verification. On failure, throws {@link X402PaymentRequiredError} (map to HTTP 402).
   */
  async verifyPayment(
    proof: X402PaymentProof,
    verifier: X402PaymentVerifier,
    context?: X402VerificationContext,
  ): Promise<X402VerificationSuccess> {
    const result: X402VerificationResult = await verifier.verify({ proof, context });
    if (result.valid === false) {
      throw new X402PaymentRequiredError(result.reason, result.details);
    }
    return result;
  }

  /**
   * Steps 2–3 — run the protected handler, then create a Psilo escrow with job metadata attached.
   */
  async executeAndCreateEscrow<T>(
    verification: X402VerificationSuccess,
    execute: (v: X402VerificationSuccess) => Promise<{ result: T; metadata: JobExecutionMetadata }>,
    escrowParams: X402EscrowCreateParams,
  ): Promise<X402FlowExecuteResult<T>> {
    const { result, metadata } = await execute(verification);
    const createDto = PsiloX402Wrapper.buildCreateEscrowDto(metadata, escrowParams);
    const escrow = await this.psilo.escrow.create(createDto);
    return { verification, result, metadata, escrow };
  }

  /**
   * Full pipeline: verify x402 proof → execute job → create escrow.
   */
  async runVerifiedJobWithEscrow<T>(
    proof: X402PaymentProof,
    verifier: X402PaymentVerifier,
    execute: (v: X402VerificationSuccess) => Promise<{ result: T; metadata: JobExecutionMetadata }>,
    escrowParams: X402EscrowCreateParams,
    verificationContext?: X402VerificationContext,
  ): Promise<X402FlowExecuteResult<T>> {
    const verification = await this.verifyPayment(proof, verifier, verificationContext);
    return this.executeAndCreateEscrow(verification, execute, escrowParams);
  }

  /**
   * Step 4 — evaluate release conditions, then release escrow funds if allowed.
   */
  async releaseConditionally(
    evaluator: X402ReleaseConditionEvaluator,
    ctx: ReleaseEvaluationContext,
    releasePayload?: ReleaseDto,
  ) {
    const allowed = await evaluator.evaluate(ctx);
    if (!allowed) {
      throw new Error("Release conditions not satisfied");
    }
    return this.psilo.escrow.release(ctx.chainId, ctx.escrowAddress, releasePayload);
  }

  /**
   * Build a client notification payload after a successful release (Step 4).
   */
  static buildReleaseNotification(
    metadata: JobExecutionMetadata,
    chainId: string,
    escrowAddress: string,
    txHash: string,
    recipientNote?: string,
  ): X402ReleaseNotification {
    return {
      jobId: metadata.jobId,
      chainId,
      escrowAddress,
      txHash,
      recipientNote,
    };
  }

  static buildCreateEscrowDto(metadata: JobExecutionMetadata, params: X402EscrowCreateParams): CreateEscrowDto {
    const description =
      params.description !== undefined
        ? params.description
        : serializeJobMetadataForEscrow(metadata);
    return {
      ...params,
      title: params.title ?? `Job ${metadata.jobId}`,
      description,
    };
  }
}
