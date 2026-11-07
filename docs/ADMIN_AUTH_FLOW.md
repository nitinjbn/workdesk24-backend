# Admin Web Auth Flow (Cookie + CSRF + Refresh Rotation)

This document explains how the admin frontend should integrate with backend auth endpoints under `/api/v1/admin`.

For a plain-language explanation of handoff, switching, refresh, logout and every
related database column, see [SWITCH_USER_IMPLEMENTATION_GUIDE.md](SWITCH_USER_IMPLEMENTATION_GUIDE.md).

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

### Super Admin host support

- While authenticated on `/api/v1/superadmin`, call `POST /api/v1/superadmin/switchUser/handoff` with the Super Admin CSRF header.
- The response returns a short-lived CSRF value and sets one-time handoff cookies scoped only to `/api/v1/admin/switchUser`.
- Call `POST /api/v1/admin/switchUser` with `{ "hostId": 42 }` and the returned `x-csrf-token`. The browser sends the handoff cookies automatically.
- The response replaces the admin cookies with a support session. The response identifies the original Super Admin, selected host, and `SUPPORT_FULL` or `SUPPORT_READ_ONLY` access mode.
- Subsequent host changes call the same switch endpoint using the active admin cookies and latest CSRF value. A stale access context is rejected; refresh the session before retrying.
- Expired, absent, disabled, or unpaid subscriptions are read-only. Read-only support may use explicitly allowed query endpoints; other admin routes are denied regardless of HTTP method.
- Admin logout terminates an active switch session and invalidates its access tokens immediately.
- Serialize refresh calls per browser session (single-flight). A duplicate request using the previous refresh token is treated as replay and revokes that token family; the server does not retain replacement secrets to safely replay the same response.

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

### Dynamic Tenant Subdomains

Set `CORS_SUBDOMAIN_DOMAINS=workdesk24.com` in the backend environment to allow any
canonical HTTPS subdomain origin, for example `https://test.workdesk24.com` or
`https://customer123.workdesk24.com`. Nested subdomains are also allowed.
Only configure base domains whose subdomain frontend content you control.

The root `https://workdesk24.com` is not included. List it in `CORS_ORIGINS` if needed.
HTTP subdomains, non-default ports, trailing dots, wildcard strings and lookalike
domains are rejected. Responses reflect the approved request origin with credentials
enabled; they never use an `Access-Control-Allow-Origin: *` wildcard.

Production requires at least one exact origin or subdomain base domain. Multiple
base domains may be comma-separated. For local frontend development, separately set
`CORS_ORIGINS=http://localhost:3000` using the actual frontend origin/port.
The default entrypoint loads the root `.env`; on Railway set service variables.
Restart the API after changing configuration. Do not put `https://`, `*.` or a path
in `CORS_SUBDOMAIN_DOMAINS`.

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
