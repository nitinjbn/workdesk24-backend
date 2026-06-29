# Next.js Usage for `/api/v1/admin/login`

## Backend route

The Express route is registered as:

- `POST /api/v1/admin/login`

The controller sets:

- `accessToken` cookie (httpOnly)
- `refreshToken` cookie (httpOnly)
- `csrfToken` cookie

And returns JSON with:

- `success`
- `message`
- `data.user`
- `data.permissions`
- `data.csrfToken`

## Why your context resets after refresh

React context/state is memory-only. When the browser refreshes, all in-memory state is lost.

To keep the logged-in user available after refresh, persist the user data locally and rehydrate it on app load.

> Do not try to read the httpOnly auth cookies from JavaScript. Those are handled by the browser automatically via `fetch` with `credentials: 'include'`.

## Next.js client-side login flow

### 1. API helper

Create a helper to call the login endpoint:

```ts
// lib/api.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export type AdminLoginPayload = {
  email: string;
  password: string;
};

export type AdminLoginResponse = {
  success: boolean;
  message: string;
  data: {
    user: {
      id: number;
      name: string;
      email: string;
      [key: string]: unknown;
    };
    permissions: unknown;
    csrfToken: string;
  };
};

export async function loginAdmin(payload: AdminLoginPayload): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || 'Login request failed');
  }

  return response.json();
}
```

### 2. Auth context with persistence

Use localStorage for the user object and CSRF token so the user remains signed in after refresh.

```tsx
// context/AuthContext.tsx

'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginAdmin, AdminLoginPayload } from '@/lib/api';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  [key: string]: unknown;
};

export type AuthState = {
  user: AuthUser | null;
  csrfToken: string | null;
  loading: boolean;
  login: (payload: AdminLoginPayload) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const USER_STORAGE_KEY = 'admin-auth-user';
const CSRF_STORAGE_KEY = 'admin-auth-csrf';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = typeof window !== 'undefined' ? window.localStorage.getItem(USER_STORAGE_KEY) : null;
    const savedCsrf = typeof window !== 'undefined' ? window.localStorage.getItem(CSRF_STORAGE_KEY) : null;

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    if (savedCsrf) {
      setCsrfToken(savedCsrf);
    }
    setLoading(false);
  }, []);

  const login = async (payload: AdminLoginPayload) => {
    const result = await loginAdmin(payload);
    if (!result.success) {
      throw new Error(result.message);
    }

    setUser(result.data.user);
    setCsrfToken(result.data.csrfToken);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.data.user));
    window.localStorage.setItem(CSRF_STORAGE_KEY, result.data.csrfToken);
  };

  const logout = () => {
    setUser(null);
    setCsrfToken(null);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    window.localStorage.removeItem(CSRF_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ user, csrfToken, loading, login, logout }),
    [user, csrfToken, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 3. Use the provider in your Next.js app

If using the App Router, wrap your app in `AuthProvider`:

```tsx
// app/providers.tsx

'use client';

import { AuthProvider } from '@/context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

```tsx
// app/layout.tsx

import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 4. Login page example

```tsx
// app/login/page.tsx

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      </form>
    </main>
  );
}
```

### 5. Using stored data after refresh

When the page reloads, `AuthProvider` rehydrates:

- `user` from `localStorage`
- `csrfToken` from `localStorage`

This allows components to read the user again after refresh.

```tsx
// app/dashboard/page.tsx

'use client';

import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please login first.</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <p>Email: {user.email}</p>
    </div>
  );
}
```

## Important details

- Use `credentials: 'include'` in the fetch call so the browser sends/receives cookies.
- Store only non-sensitive app data in `localStorage` (user info, CSRF token, permissions).
- The actual auth tokens remain in httpOnly cookies and are not accessible from JS.
- If you want session renewal, call `/api/v1/admin/refresh` from the frontend with `credentials: 'include'` and the CSRF token.

## Summary

To use `/login` correctly in Next.js:

1. Call `POST /api/v1/admin/login` with `fetch` and `credentials: 'include'`.
2. Save returned `data.user` and `data.csrfToken` in local storage or another persistent layer.
3. Rehydrate that data on page load so context does not become blank after refresh.
4. Let the browser manage the auth cookies automatically.
