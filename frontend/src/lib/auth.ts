export const AUTH_STORAGE_KEY = "pm-authenticated";

export const isValidCredentials = (username: string, password: string) =>
  username === "user" && password === "password";
