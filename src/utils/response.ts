import { backOff } from "./backOff/backoff";
import { SDKError } from "./errors";

export enum Status {
  SUCCESS = "success",
  ERROR = "error",
}

export interface ResponseDto<T> {
  data: T;
  status: Status;
  message?: string;
  code?: number;
  statusCode?: number;
  validation?: Record<string, any>;
}

export type IAny = any;

// Some endpoints (job delete, withdraw application) send the success
// message at the top level of the envelope instead of nested under `data`,
// even though their declared return type promises `data: { message: string }`.
// Normalize that shape here so callers can rely on the documented contract
// rather than each call site guessing whether `data` is populated.
export const normalizeMessageResponse = <T extends { message: string }>(response: any): ResponseDto<T> => {
  if (response && (response.data === undefined || response.data === null) && typeof response.message === "string") {
    return { ...response, data: { message: response.message } as T };
  }
  return response as ResponseDto<T>;
};

type ErrorWithMessage = {
  message: string[] | object[] | any;
  code?: string;
  details?: any;
};

// A 4xx means the request itself was rejected (bad input, no permission) —
// replaying it changes nothing. Only retry when there's no HTTP status at
// all (a network/timeout failure, no response received) or the server
// itself failed (5xx), where a retry might genuinely succeed.
const isRetryable = (e: unknown): boolean => {
  if (!(e instanceof SDKError) || typeof e.status !== "number") return true;
  return e.status >= 500;
};

export const ErrorUtils = {
  newTryFail: async <T>(f: (() => Promise<T>) | (() => T)): Promise<T> => {
    try {
      const data = await backOff(
        async () => {
          return await f();
        },
        {
          startingDelay: 50,
          timeMultiple: 10,
          numOfAttempts: 10,
          maxDelay: 3550,
          delayFirstAttempt: false,
          retry: (e) => isRetryable(e),
        },
      );

      return { ...data };
    } catch (e) {
      const parseErr = ErrorUtils.toErrorWithMessage(e);
      return {
        data: null as unknown as T,
        status: Status.ERROR,
        message: parseErr ? parseErr.message : ["Internal Server Error"],
        code: parseErr.code,
        validation: parseErr?.details,
      } as unknown as T;
    }
  },
  formatErrorMsg: (message: string) => {
    return message.replace("attr.", "");
  },
  toErrorWithMessage: (maybeError: unknown): ErrorWithMessage => {
    if (typeof maybeError === "string") {
      try {
        const error = JSON.parse(maybeError as string);
        if (error.data instanceof Array && error.data.length > 0) {
          return {
            message: (error.data as string[]).map((message) => ErrorUtils.formatErrorMsg(message)),
            code: error.errorCode,
          };
        }

        return {
          message: [error.message ?? maybeError],
          code: error.errorCode,
        };
        // eslint-disable-next-line no-empty
      } catch (_) {}
    }

    if (ErrorUtils.isErrorWithMessage(maybeError)) {
      const details = maybeError instanceof SDKError ? maybeError.details : undefined;
      return { message: [maybeError.message], code: maybeError.code, details };
    }

    try {
      return {
        message: [JSON.stringify(maybeError, null, 2)],
      };
    } catch {
      // fallback in case there's an error stringifying the maybeError
      // like with circular references for example.
      return { message: [String(maybeError)] };
    }
  },
  isErrorWithMessage(e: unknown): e is ErrorWithMessage {
    return (
      typeof e === "object" &&
      e !== null &&
      "message" in e &&
      typeof (e as Record<string, unknown>).message === "string"
    );
  },
};

export const parseUrlWithQuery = (url: string, filter: object | any) => {
  const entries = Object.entries(filter || {}).filter(([, value]) =>
    value !== undefined && value !== null && value !== "undefined" && value !== "null"
  );
  if (entries.length === 0) return url;
  const qs = entries.map(([key, value]) => `${key}=${value}`).join("&");
  return `${url}?${qs}`;
};
