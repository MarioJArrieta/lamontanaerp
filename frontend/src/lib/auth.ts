import type { User } from '@/types';

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function getUser(): User | null {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function setAuth(token: string, user: User) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

// Nombre de la empresa del usuario logueado. Sesiones anteriores al multi-tenant
// no traen tenant_name y solo podian ser de La Montana.
export function getCompanyName(): string {
  return getUser()?.tenant_name || 'La Montana';
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
