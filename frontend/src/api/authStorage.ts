const AUTH_STORAGE_KEY = 'auth-storage';
const GUEST_AUTH_STORAGE_KEY = 'daemon-directorate-guest-session';

export interface PersistedAuthState {
  [key: string]: unknown;
}

export interface AuthStatePayload {
  token: string | null;
  user?: unknown;
  loginUrl?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readAuthStorage = (): PersistedAuthState => {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as PersistedAuthState) : {};
  } catch {
    return {};
  }
};

const writeAuthStorage = (next: PersistedAuthState): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
};

export const getAuthStorage = (): PersistedAuthState => {
  return readAuthStorage();
};

export const getAuthState = (): AuthStatePayload => {
  const storage = readAuthStorage();
  const rawState = isRecord(storage.state) ? storage.state : {};

  const token =
    typeof rawState.token === 'string'
      ? rawState.token
      : typeof storage.token === 'string'
        ? (storage.token as string)
        : null;

  return {
    token,
    user: rawState.user,
    loginUrl:
      typeof rawState.loginUrl === 'string'
        ? rawState.loginUrl
        : typeof storage.loginUrl === 'string'
          ? (storage.loginUrl as string)
          : undefined,
  };
};

export const setAuthStorage = (token: string, user: unknown | null = null): void => {
  const storage = readAuthStorage();
  const state = isRecord(storage.state) ? storage.state : {};

  const nextState: PersistedAuthState = {
    ...storage,
    state: {
      ...state,
      token,
      ...(user ? { user } : {}),
    },
  };

  writeAuthStorage(nextState);
};

export const setAuthLoginUrl = (loginUrl: string): void => {
  const storage = readAuthStorage();
  const state = isRecord(storage.state) ? storage.state : {};

  writeAuthStorage({
    ...storage,
    state: {
      ...state,
      loginUrl,
    },
  });
};

export const clearAuthToken = (): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(GUEST_AUTH_STORAGE_KEY);
  }
};

export const hasAuthToken = (): boolean => {
  return getAuthState().token !== null;
};

export const getAuthUser = (): unknown | null => {
  const { user } = getAuthState();
  return user ?? null;
};

export const isGuestAuthUser = (): boolean => {
  const user = getAuthUser();
  return isRecord(user) && user.is_guest === true;
};
