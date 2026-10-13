import { ja } from '@/i18n/ja';
import { ApiError } from './ApiError';

/** Maps any error to a user-facing Japanese message. */
export function errorMessageOf(error: unknown): string {
  if (!ApiError.isApiError(error)) {
    return ja.error.unexpected;
  }
  if (error.code === 'NETWORK_ERROR') {
    return ja.error.network;
  }
  const messages: Partial<Record<string, string>> = ja.error;
  return messages[error.code] ?? ja.error.unexpected;
}
