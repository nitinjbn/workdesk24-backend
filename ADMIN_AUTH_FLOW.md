# Admin Web Auth Flow (Cookie + CSRF + Refresh Rotation)

This document explains how the admin frontend should integrate with backend auth endpoints under `/api/v1/admin`.

## Security Model

- Access token is stored in an HttpOnly cookie (not readable by JavaScript).
- Refresh token is stored in an HttpOnly cookie.
- CSRF token is stored in a readable cookie and also returned in response body.
- All state-changing admin API requests require `x-csrf-token` header.
- Refresh tokens are rotated on every refresh call.

## Required Frontend Settings

- Always send credentials/cookies with requests.
- Read CSRF token from login/refresh response body (preferred) or CSRF cookie.
- Attach `x-csrf-token` header on:
  - `/api/v1/admin/refresh`
  - `/api/v1/admin/logout`
  - all protected admin endpoints (users, inquiries, dashboard, etc.)

## Endpoints

### 1) Login

- Method: `POST`
- URL: `/api/v1/admin/login`
- Body:

```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

- Success behavior:
  - sets access cookie
  - sets refresh cookie
  - sets csrf cookie
  - returns:

```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@example.com"
    },
    "csrfToken": "..."
  }
}
```

Store `data.csrfToken` in memory/state and use it in subsequent requests.

### 2) Call Protected Admin APIs

- Method: `POST`
- URL example: `/api/v1/admin/users/list`
- Headers: `x-csrf-token: <csrfToken>`
- Must include credentials so cookies are sent.

If access token expires, backend returns `401`.

### 3) Refresh Session

- Method: `POST`
- URL: `/api/v1/admin/refresh`
- Headers: `x-csrf-token: <csrfToken>`
- Body: optional `{}`
- Must include credentials.

- Success behavior:
  - rotates refresh token
  - sets new access cookie
  - sets new refresh cookie
  - sets new csrf cookie
  - returns new `csrfToken` in response body

Replace your in-memory CSRF token with the new one immediately.

### 4) Logout

- Method: `POST`
- URL: `/api/v1/admin/logout`
- Headers: `x-csrf-token: <csrfToken>`
- Body: optional `{}`
- Must include credentials.

- Success behavior:
  - revokes session token in backend
  - clears access, refresh, and csrf cookies

## Axios Example

```ts
import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true,
});

let csrfToken: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

api.interceptors.request.use((config) => {
  if (csrfToken) {
    config.headers = {
      ...config.headers,
      'x-csrf-token': csrfToken,
    };
  }
  return config;
});

const loginAdmin = async (email: string, password: string) => {
  const response = await api.post('/api/v1/admin/login', { email, password });
  csrfToken = response.data?.data?.csrfToken || null;
  return response.data?.data?.user;
};

const refreshAdminSession = async () => {
  const response = await api.post('/api/v1/admin/refresh', {});
  csrfToken = response.data?.data?.csrfToken || null;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as any;

    if (status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAdminSession().finally(() => {
        isRefreshing = false;
      });
    }

    try {
      await refreshPromise;
      originalRequest._retry = true;
      return api(originalRequest);
    } catch {
      csrfToken = null;
      return Promise.reject(error);
    }
  }
);

const logoutAdmin = async () => {
  try {
    await api.post('/api/v1/admin/logout', {});
  } finally {
    csrfToken = null;
  }
};
```

## Fetch Example

```ts
let csrfToken: string | null = null;

const apiPost = async (path: string, body: unknown) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const payload = await response.json();

  if (!response.ok) {
    const err = new Error(payload?.message || 'Request failed');
    (err as any).status = response.status;
    throw err;
  }

  return payload;
};

const login = async (email: string, password: string) => {
  const payload = await apiPost('/api/v1/admin/login', { email, password });
  csrfToken = payload?.data?.csrfToken || null;
};

const refresh = async () => {
  const payload = await apiPost('/api/v1/admin/refresh', {});
  csrfToken = payload?.data?.csrfToken || null;
};
```

## CORS and Cookie Notes

Backend must allow credentials and your admin origin:

- `CORS_ORIGINS=https://admin.example.com`
- `ADMIN_AUTH_COOKIE_SECURE=true` in production
- `ADMIN_AUTH_COOKIE_SAME_SITE=lax` for same-site
- Use `sameSite=none` only for cross-site HTTPS setups

## Failure Handling

- `401` on protected endpoint:
  - try one refresh call
  - if refresh fails, redirect to login
- `403` with CSRF message:
  - token mismatch or missing header
  - refresh session or re-login to recover

## Minimal Frontend Checklist

- Use `withCredentials: true` / `credentials: 'include'`
- Keep CSRF token in memory and update after login/refresh
- Send `x-csrf-token` on all admin POST requests
- Auto-refresh once on `401`
- Logout clears client auth state
