const API_BASE = 'http://localhost:8000';

export function getToken(): string | null {
  return localStorage.getItem('fleet_token');
}

export function setToken(token: string) {
  localStorage.setItem('fleet_token', token);
}

export function clearToken() {
  localStorage.removeItem('fleet_token');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    window.location.reload();
  }

  return response;
}
