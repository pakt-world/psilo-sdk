/**
 * Thrown when x402 payment proof is missing, invalid, or the micropayment cannot be settled.
 * Maps to HTTP 402 Payment Required at the gateway.
 */
export class X402PaymentRequiredError extends Error {
  readonly statusCode = 402;
  readonly code = "X402_PAYMENT_REQUIRED";

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "X402PaymentRequiredError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isX402PaymentRequiredError(e: unknown): e is X402PaymentRequiredError {
  return e instanceof X402PaymentRequiredError;
}
