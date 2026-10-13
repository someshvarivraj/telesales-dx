import type {
  ChangePasswordRequest,
  LoginRequest,
  SessionResponse,
  SessionUser,
} from '@telesales/shared';
import { type ApiClient, apiClient } from '@/lib/api/ApiClient';
import { ApiError } from '@/lib/api/ApiError';

export class AuthApi {
  constructor(private readonly client: ApiClient) {}

  /** Returns the signed-in user, or null when there is no valid session. */
  async fetchSession(signal?: AbortSignal): Promise<SessionUser | null> {
    try {
      const { user } = await this.client.get<SessionResponse>('/auth/me', signal);
      return user;
    } catch (error) {
      if (ApiError.isApiError(error) && error.isUnauthenticated) {
        return null;
      }
      throw error;
    }
  }

  async login(request: LoginRequest): Promise<SessionUser> {
    const { user } = await this.client.post<SessionResponse>('/auth/login', request);
    return user;
  }

  async logout(): Promise<void> {
    await this.client.post<undefined>('/auth/logout');
  }

  async changePassword(request: ChangePasswordRequest): Promise<SessionUser> {
    const { user } = await this.client.post<SessionResponse>('/auth/password', request);
    return user;
  }
}

export const authApi = new AuthApi(apiClient);
