import { apiClient } from './apiClient';
import { ApiResponse } from './types';
import { clearStorageValue, readFrontpageToken, readGuestSession, saveGuestSession } from '@webhatchery/auth-react';

const GUEST_AUTH_STORAGE_KEY = 'daemon-directorate-guest-session';

export const getStoredAuthToken = (): string | null => {
  return readFrontpageToken() ?? readGuestSession<BackendUser>(GUEST_AUTH_STORAGE_KEY)?.token ?? null;
};

export const ensureGuestSession = async (force = false): Promise<void> => {
  if (!force && getStoredAuthToken()) {
    return;
  }

  if (force) {
    clearStorageValue(GUEST_AUTH_STORAGE_KEY);
  }

  const guestSession = await createGuestSession();
  saveGuestSession(GUEST_AUTH_STORAGE_KEY, guestSession);
};

export interface BackendUser {
  id: string;
  email: string | null;
  username: string;
  display_name: string;
  roles?: string[];
  is_guest?: boolean;
  auth_type?: string;
}

export interface BackendGamePayload {
  [key: string]: unknown;
}

export interface BackendLoadPayload {
  user: BackendUser;
  game_state: BackendGamePayload | null;
  updated_at?: string | null;
}

export interface BackendGuestSessionPayload {
  token: string;
  user: BackendUser;
}

export interface BackendLinkGuestPayload {
  merged: boolean;
  game_state: BackendGamePayload;
}

export const getLoginInfo = async (): Promise<{ login_url: string }> => {
  const response = await apiClient.get<ApiResponse<{ login_url: string }>>('/api/auth/login-info');

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Unable to load login information.');
  }

  return response.data.data;
};

export const createGuestSession = async (): Promise<BackendGuestSessionPayload> => {
  const response = await apiClient.post<ApiResponse<BackendGuestSessionPayload>>('/api/auth/guest-session', {});

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Unable to create guest session.');
  }

  return response.data.data;
};

export const linkGuestSession = async (guestToken: string): Promise<BackendLinkGuestPayload> => {
  const response = await apiClient.post<ApiResponse<BackendLinkGuestPayload>>('/api/auth/link-guest', { guest_token: guestToken });

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Unable to link guest session.');
  }

  return response.data.data;
};

export const loadGameState = async (): Promise<BackendGamePayload> => {
  const response = await apiClient.get<ApiResponse<BackendLoadPayload>>('/api/game');

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Unable to load game state.');
  }

  return response.data.data.game_state || {};
};

export const startNewGame = async (
  payload: BackendGamePayload = {}
): Promise<BackendGamePayload> => {
  const response = await apiClient.post<ApiResponse<BackendLoadPayload>>('/api/game/start', { state: payload });

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Unable to start game.');
  }

  return response.data.data.game_state || {};
};

export const persistGameState = async (gameState: BackendGamePayload): Promise<BackendGamePayload> => {
  const response = await apiClient.post<ApiResponse<BackendLoadPayload>>('/api/game/save', { game_state: gameState });

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Unable to save game state.');
  }

  return response.data.data.game_state || {};
};

export const applyGameAction = async (
  actionType: string,
  payload: BackendGamePayload
): Promise<BackendGamePayload> => {
  const response = await apiClient.post<ApiResponse<BackendLoadPayload>>(`/api/game/action/${actionType}`, payload);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Unable to apply game action.');
  }

  return response.data.data.game_state || {};
};
