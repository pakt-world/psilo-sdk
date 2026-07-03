import { backOff } from "./backOff/backoff";

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

type ErrorWithMessage = {
  message: string[] | object[] | any;
  code?: string;
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
      return { message: [maybeError.message] };
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
