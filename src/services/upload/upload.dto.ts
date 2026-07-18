import { ResponseDto } from "../../utils/response";

export interface UploadModuleType {
  upload(file: Buffer, filename: string, mimetype: string): Promise<ResponseDto<FileRecord>>;
  uploadPrivate(file: Buffer, filename: string, mimetype: string): Promise<ResponseDto<FileRecord>>;
  getUploads(filter?: FileListFilter): Promise<ResponseDto<FileListResponse>>;
  getUpload(id: string): Promise<ResponseDto<FileRecord>>;
  getPresignedUrl(id: string): Promise<ResponseDto<PresignedUrlResponse>>;
}

export interface UploadedByUser {
  _id: string;
  firstName: string;
  lastName: string;
  type: string;
  score: number;
  profile: {
    talent: {
      tags: string[];
      availability: string;
      tagsIds: object[];
    };
  };
}

export interface FileRecord {
  _id: string;
  name: string;
  uploaded_by: UploadedByUser | string;
  url: string;
  meta: Record<string, unknown> | undefined;
  status: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  deletedAt?: string | Date;
}

export interface FileListResponse {
  count: number;
  pages: number;
  data: FileRecord[];
}

export interface FileListFilter {
  page?: string | number;
  limit?: string | number;
  name?: string;
  type?: string;
  ids?: string;
  urls?: string;
}

export interface PresignedUrlResponse {
  fileName: string;
  url: string;
}
