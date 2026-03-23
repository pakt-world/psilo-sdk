/** Production Psilo Escrow API base URL. */
export const PSILO_API_BASE_URL_LIVE = "https://escrowapi.psiloai.com";

/** Development / test Psilo Escrow API base URL. */
// export const PSILO_API_BASE_URL_TEST = "https://devescrowapi.psiloai.com";
export const PSILO_API_BASE_URL_TEST = "http://localhost:4005";

export interface PsiloBaseUrlConfig {
  baseUrl?: string;
  /** When `true` and `baseUrl` is omitted, {@link PSILO_API_BASE_URL_TEST} is used. */
  isTest?: boolean;
}

/**
 * Resolves the API base URL: explicit `baseUrl` wins; otherwise `isTest` selects test vs live default.
 */
export function resolvePsiloApiBaseUrl(config: PsiloBaseUrlConfig): string {
  if (config.baseUrl !== undefined && config.baseUrl.length > 0) {
    return config.baseUrl.replace(/\/$/, "");
  }
  if (config.isTest === true) {
    return PSILO_API_BASE_URL_TEST;
  }
  return PSILO_API_BASE_URL_LIVE;
}
