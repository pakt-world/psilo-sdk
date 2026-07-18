import FormData from "form-data";
import { Container, Service } from "typedi";
import { Connector, StandardResponse } from "../../connector";
import { ErrorUtils, ResponseDto, parseUrlWithQuery } from "../../utils/response";
import {
  FileListFilter,
  FileListResponse,
  FileRecord,
  PresignedUrlResponse,
  UploadModuleType,
} from "./upload.dto";

@Service({
  factory: (data: { id: string }) => {
    return new UploadService(data.id);
  },
  transient: true,
})
export class UploadService implements UploadModuleType {
  private id: string;
  private connector: Connector;

  constructor(id: string) {
    this.id = id;
    this.connector = Container.of(this.id).get(Connector);
  }

  public async upload(file: Buffer, filename: string, mimetype: string): Promise<ResponseDto<FileRecord>> {
    return ErrorUtils.newTryFail(async () => {
      const form = new FormData();
      form.append("file", file, { filename, contentType: mimetype });
      const response = await this.connector.postForm<StandardResponse<FileRecord>>("/v1/upload", form);
      return response as unknown as ResponseDto<FileRecord>;
    });
  }

  public async uploadPrivate(file: Buffer, filename: string, mimetype: string): Promise<ResponseDto<FileRecord>> {
    return ErrorUtils.newTryFail(async () => {
      const form = new FormData();
      form.append("file", file, { filename, contentType: mimetype });
      const response = await this.connector.postForm<StandardResponse<FileRecord>>("/v1/upload/private", form);
      return response as unknown as ResponseDto<FileRecord>;
    });
  }

  public async getUploads(filter?: FileListFilter): Promise<ResponseDto<FileListResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const url = parseUrlWithQuery("/v1/upload", filter ?? {});
      const response = await this.connector.get<StandardResponse<FileListResponse>>(url);
      return response as unknown as ResponseDto<FileListResponse>;
    });
  }

  public async getUpload(id: string): Promise<ResponseDto<FileRecord>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<FileRecord>>(`/v1/upload/${id}`);
      return response as unknown as ResponseDto<FileRecord>;
    });
  }

  public async getPresignedUrl(id: string): Promise<ResponseDto<PresignedUrlResponse>> {
    return ErrorUtils.newTryFail(async () => {
      const response = await this.connector.get<StandardResponse<PresignedUrlResponse>>(`/v1/upload/url/${id}`);
      return response as unknown as ResponseDto<PresignedUrlResponse>;
    });
  }
}
