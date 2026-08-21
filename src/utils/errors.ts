export class SDKError extends Error {
  public readonly code?: string;
  public readonly details?: any;
  public readonly status?: number;

  constructor(message: string, code?: string, details?: any, status?: number) {
    super(message);
    this.name = "SDKError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}
