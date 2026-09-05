const AUTH_TOKEN_KEY = "pm-auth-token";

export const getStoredToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

export const storeToken = (token: string): void => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearToken = (): void => {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
};
