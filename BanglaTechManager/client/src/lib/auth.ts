export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: string;
}

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("auth_token");
}

export function getUser(): AuthUser | null {
  const userStr = localStorage.getItem("auth_user");
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

export function removeUser(): void {
  localStorage.removeItem("auth_user");
}

export function logout(): void {
  removeToken();
  removeUser();
}
