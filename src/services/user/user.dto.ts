import { ResponseDto } from "../../utils/response";
import { FileRecord } from "../upload/upload.dto";

export interface SearchUsersQuery {
  search?: string;
  tags?: string;
  limit?: number;
  page?: number;
  userName?: string;
  role?: string;
}

export interface UserListResult {
  data: UserProfile[];
  total: number;
  page: number;
  limit: number;
}

export interface UserModuleType {
  update(data: AccountUpdateDto): Promise<ResponseDto<UserProfile>>;
  searchUsers(query?: SearchUsersQuery): Promise<ResponseDto<UserListResult>>;
  getUserById(id: string): Promise<ResponseDto<UserProfile>>;
  getUserByWalletAddress(address: string): Promise<ResponseDto<UserProfile>>;
  getProfile(): Promise<ResponseDto<UserProfile>>;
}

// ── Request ───────────────────────────────────────────────────────────────────

export interface BioDto {
  title?: string;
  description?: string;
}

export interface ContactDto {
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  phone?: string;
}

export interface TalentDto {
  about?: string;
  tagCategory?: string;
  tags?: string[];
  availability?: string;
}

export interface ProfileDto {
  bio?: BioDto;
  contact?: ContactDto;
  talent?: TalentDto;
}

export interface SocialsDto {
  github?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

export interface AccountUpdateDto {
  firstName?: string;
  lastName?: string;
  userName?: string;
  profileImage?: FileRecord["_id"];
  bgImage?: FileRecord["_id"];
  isPrivate?: boolean;
  meta?: Record<string, unknown>;
  profile?: ProfileDto;
  socials?: SocialsDto;
}

// ── Response ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  status: string;
  role: string;
  type: string;
  referralCode: string;
  profile?: ProfileDto;
  profileImage?: FileRecord | string;
  bgImage?: FileRecord | string;
  socials?: SocialsDto;
  score: number;
  isPrivate: boolean;
  meta: Record<string, unknown>;
  timeZone: string | null;
  walletAddress: string | null;
  twoFa?: {
    type: string;
    status: boolean;
    securityQuestion?: string;
  };
  isVerified: boolean;
  profileCompleteness: number;
  createdAt: string;
  kyc: boolean;
  kycStatus: unknown;
}
