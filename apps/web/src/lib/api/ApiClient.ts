import { type ApiErrorBody, CSRF_HEADER, CSRF_HEADER_VALUE } from '@telesales/shared';
import { ApiError } from './ApiError';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

/** Query-string from an object, skipping empty values. */
export function toQuery(
  params: Record<string, string | number | boolean | null | undefined | string[]>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

function fileNameFrom(header: string | null, fallback: string): string {
  const encoded = header ? /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1] : undefined;
  return encoded ? decodeURIComponent(encoded) : fallback;
}

/**
 * Thin, typed wrapper around fetch for the same-origin API.
 * Sends the session cookie and the CSRF header, and normalises errors to ApiError.
 */
export class ApiClient {
  constructor(private readonly baseUrl = `${import.meta.env.BASE_URL}api`) {}

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', path, undefined, signal);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /** multipart/form-data upload (files + fields). */
  upload<T>(path: string, form: FormData): Promise<T> {
    return this.request<T>('POST', path, form);
  }

  async download(path: string, fallbackName: string): Promise<DownloadedFile> {
    const response = await this.send('GET', path);
    if (!response.ok) {
      throw await this.toError(response);
    }
    return {
      blob: await response.blob(),
      fileName: fileNameFrom(response.headers.get('Content-Disposition'), fallbackName),
    };
  }

  private async request<T>(
    method: Method,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await this.send(method, path, body, signal);
    if (response.status === 204) {
      return undefined as T;
    }
    if (!response.ok) {
      throw await this.toError(response);
    }
    return (await response.json().catch(() => undefined)) as T;
  }

  private async send(
    method: Method,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const isForm = body instanceof FormData;
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          [CSRF_HEADER]: CSRF_HEADER_VALUE,
          ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new ApiError(0, 'NETWORK_ERROR');
    }
  }

  private async toError(response: Response): Promise<ApiError> {
    const payload: unknown = await response.json().catch(() => undefined);
    const errorBody = (payload as ApiErrorBody | undefined)?.error;
    return new ApiError(
      response.status,
      errorBody?.code ?? 'UNKNOWN',
      errorBody?.fields,
      errorBody?.details,
    );
  }
}

export const apiClient = new ApiClient();

/** Saves a downloaded file through a temporary link. */
export function saveFile({ blob, fileName }: DownloadedFile): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
