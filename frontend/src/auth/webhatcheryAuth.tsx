import { buildApiUrl, createAuth } from '@webhatchery/auth-react';
import type { BaseAuthUser } from '@webhatchery/auth-react';
import { setWebHatcheryTokenProvider } from '../api/apiClient';

function requiredEnv(value: string | undefined, name: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`${name} must be configured.`);
  }

  return value.trim();
}

const apiBaseUrl = requiredEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL');
const apiVersion = requiredEnv(import.meta.env.VITE_API_VERSION, 'VITE_API_VERSION');

const auth = createAuth<BaseAuthUser>({
  guestAuthStorageKey: 'daemon-directorate-guest-session',
  preferredAuthModeStorageKey: 'daemon-directorate-auth-mode',
  loginUrl: requiredEnv(import.meta.env.VITE_WEB_HATCHERY_LOGIN_URL, 'VITE_WEB_HATCHERY_LOGIN_URL'),
  signupUrl: requiredEnv(import.meta.env.VITE_WEB_HATCHERY_SIGNUP_URL, 'VITE_WEB_HATCHERY_SIGNUP_URL'),
  buildApiUrl: path => buildApiUrl(apiBaseUrl, apiVersion, path),
  setTokenProvider: setWebHatcheryTokenProvider,
  endpoints: {
    currentUser: '/auth/session',
    guestSession: '/auth/guest-session',
    linkGuest: '/auth/link-guest',
  },
});

export const { AuthProvider, useAuth } = auth;
