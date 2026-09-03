import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import FormData from "form-data";
import { SDKError } from "../utils/errors";
import { Status } from "../utils/response";

export class Connector {
  private readonly client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  public setHeader(key: string, value: string): void {
    this.client.defaults.headers.common[key] = value;
  }

  public removeHeader(key: string): void {
    delete this.client.defaults.headers.common[key];
  }

  private handleResponse<T>(response: AxiosResponse<T>): T {
    const data = response.data as any;
    if (data && data.success === false) {
      throw new SDKError(
        data.error?.message || "Unknown error",
        data.error?.code || "API_ERROR",
        data.error?.details,
        response.status
      );
    }
    // Paktsuite's actual envelope signals application-level errors via
    // `status: "error"` (returned with HTTP 200), not the `success: false`
    // shape checked above — that check never fires against the real API.
    if (data && data.status === Status.ERROR) {
      const message = Array.isArray(data.message) ? data.message.join("; ") : data.message;
      throw new SDKError(
        message || "Unknown error",
        typeof data.code === "string" ? data.code : "API_ERROR",
        Array.isArray(data.message) ? data.message : data.validation,
        response.status
      );
    }
    return data;
  }

  private handleError(error: any): never {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as any;
      const status = error.response?.status;
      if (data) {
        // Paktsuite's own envelope: { error: { message, code, details } }.
        if (data.error && typeof data.error === "object") {
          throw new SDKError(
            data.error.message || error.message,
            data.error.code || "REQUEST_ERROR",
            data.error.details,
            status
          );
        }
        // NestJS's default exception shape: { statusCode, message, error },
        // where `error` is just the reason phrase (a string, not an object)
        // and the real message — often an array from the validation pipe —
        // lives at the top level.
        if (data.message !== undefined) {
          const message = Array.isArray(data.message) ? data.message.join("; ") : data.message;
          throw new SDKError(
            message || error.message,
            typeof data.error === "string" ? data.error : "REQUEST_ERROR",
            Array.isArray(data.message) ? data.message : undefined,
            status
          );
        }
      }
      throw new SDKError(error.message, error.code, error.response?.data, status);
    }
    throw new SDKError(error.message || "An unexpected error occurred", "INTERNAL_ERROR");
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.get<T>(url, config);
      return this.handleResponse<T>(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return this.handleResponse<T>(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.put<T>(url, data, config);
      return this.handleResponse<T>(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.patch<T>(url, data, config);
      return this.handleResponse<T>(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  public async postForm<T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.post<T>(url, formData, {
        ...config,
        headers: { ...formData.getHeaders(), ...config?.headers },
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.delete<T>(url, config);
      return this.handleResponse<T>(response);
    } catch (error) {
      this.handleError(error);
    }
  }
}
