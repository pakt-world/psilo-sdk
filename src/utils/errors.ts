export class SDKError extends Error {
  public readonly code?: string;
  public readonly details?: any;

  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.name = "SDKError";
    this.code = code;
    this.details = details;
  }
}
