import {
  ApiError,
  createApiClient,
  resolveApiRootUrl,
  type QueryParams,
  type TokenProvider,
} from '@webhatchery/api-client';

const GAME_SLUG = 'daemon_directorate';

function requiredEnv(value: string | undefined, name: string, allowEmpty = false): string {
  if (!allowEmpty && (!value || value.trim() === '')) {
    throw new Error(`${name} must be configured.`);
  }

  return value?.trim() ?? '';
}

const sharedApiClient = createApiClient({
  baseURL: resolveApiRootUrl(
    requiredEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
    requiredEnv(import.meta.env.VITE_API_VERSION, 'VITE_API_VERSION', true),
  ),
  guestAuthStorageKey: `${GAME_SLUG}-guest-session`,
  preserveEnvelope: true,
  onUnauthorized: (error) => {
    if (error instanceof ApiError && error.loginUrl) {
      window.dispatchEvent(
        new CustomEvent<{ loginUrl: string }>('webhatchery:login-required', {
          detail: { loginUrl: error.loginUrl },
        }),
      );
    }
  },
});

export function setWebHatcheryTokenProvider(provider: TokenProvider | null): void {
  sharedApiClient.setTokenProvider(provider);
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

interface RequestConfig {
  params?: Record<string, unknown>;
  headers?: unknown;
  data?: unknown;
  method?: string;
  url?: string;
  [key: string]: unknown;
}

function normalizeEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  return endpoint.replace(/^\/api(?:\/v1)?(?=\/|$)/, '') || '/';
}

function normalizeHeaders(value: unknown): HeadersInit | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as HeadersInit;
}

async function request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  const endpoint = normalizeEndpoint(String(config.url ?? '/'));
  const method = String(config.method ?? 'GET').toUpperCase();
  const data = await sharedApiClient.request<T>(endpoint, {
    method,
    body: config.data,
    headers: normalizeHeaders(config.headers),
    query: config.params as QueryParams | undefined,
  });

  return { data, status: 200 };
}

export const apiClient = {
  request,
  get<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return request<T>({ ...config, url: endpoint, method: 'GET' });
  },
  post<T, TBody = unknown>(endpoint: string, data?: TBody, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return request<T>({ ...config, url: endpoint, method: 'POST', data });
  },
  put<T, TBody = unknown>(endpoint: string, data?: TBody, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return request<T>({ ...config, url: endpoint, method: 'PUT', data });
  },
  patch<T, TBody = unknown>(endpoint: string, data?: TBody, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return request<T>({ ...config, url: endpoint, method: 'PATCH', data });
  },
  delete<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return request<T>({ ...config, url: endpoint, method: 'DELETE' });
  },
};

export const axiosClient = apiClient;
export default apiClient;
