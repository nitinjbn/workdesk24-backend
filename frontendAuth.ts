// Section 1: shared BFF auth utilities
import { NextResponse } from 'next/server';

export const BACKEND_URL = process.env.BACKEND_URL ?? '';
const IS_PROD = process.env.NODE_ENV === 'production';

export const ACCESS_COOKIE = 'wd24_admin_access_token';
export const REFRESH_COOKIE = 'wd24_admin_refresh_token';
export const CSRF_COOKIE = 'wd24_admin_csrf';

export type SessionCookies = {
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
};

export type BackendJsonResponse<T = unknown> = {
  success: boolean;
  message: string;
  data: T;
};

export function getSetCookieArray(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') {
    return h.getSetCookie();
  }

  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

export function extractCookieValue(setCookies: string[], cookieName: string): string | null {
  for (const line of setCookies) {
    const cookiePart = line.split(';')[0] ?? '';
    const eqIndex = cookiePart.indexOf('=');
    if (eqIndex <= 0) continue;

    const name = cookiePart.slice(0, eqIndex).trim();
    const value = cookiePart.slice(eqIndex + 1).trim();
    if (name === cookieName) {
      return value;
    }
  }

  return null;
}

export function sessionFromSetCookies(setCookies: string[]): SessionCookies {
  return {
    accessToken: extractCookieValue(setCookies, ACCESS_COOKIE),
    refreshToken: extractCookieValue(setCookies, REFRESH_COOKIE),
    csrfToken: extractCookieValue(setCookies, CSRF_COOKIE),
  };
}

function appCookieOptions(httpOnly: boolean, maxAgeSec: number) {
  return {
    httpOnly,
    secure: IS_PROD,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}

export function applySessionCookies(
  response: NextResponse,
  cookiesToApply: Partial<SessionCookies>
): void {
  if (cookiesToApply.accessToken) {
    response.cookies.set(
      ACCESS_COOKIE,
      cookiesToApply.accessToken,
      appCookieOptions(true, 60 * 15)
    );
  }

  if (cookiesToApply.refreshToken) {
    response.cookies.set(
      REFRESH_COOKIE,
      cookiesToApply.refreshToken,
      appCookieOptions(true, 60 * 60 * 24 * 30)
    );
  }

  if (cookiesToApply.csrfToken) {
    response.cookies.set(
      CSRF_COOKIE,
      cookiesToApply.csrfToken,
      appCookieOptions(false, 60 * 60 * 24 * 30)
    );
  }
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  response.cookies.delete(CSRF_COOKIE);
}

export function buildBackendCookieHeader(input: {
  accessToken?: string | null;
  refreshToken?: string | null;
  csrfToken?: string | null;
}): string {
  const parts: string[] = [];

  if (input.accessToken) {
    parts.push(ACCESS_COOKIE + '=' + input.accessToken);
  }
  if (input.refreshToken) {
    parts.push(REFRESH_COOKIE + '=' + input.refreshToken);
  }
  if (input.csrfToken) {
    parts.push(CSRF_COOKIE + '=' + input.csrfToken);
  }

  return parts.join('; ');
}

export async function parseBackendBody<T = unknown>(
  response: Response
): Promise<BackendJsonResponse<T> | { success: false; message: string; data: null }> {
  const text = await response.text();

  try {
    return JSON.parse(text) as BackendJsonResponse<T>;
  } catch {
    return {
      success: false,
      message: text || 'Invalid backend response',
      data: null,
    };
  }
}



// Section 2: BFF login route handler
import { NextRequest, NextResponse } from 'next/server';
import {
  BACKEND_URL,
  applySessionCookies,
  getSetCookieArray,
  parseBackendBody,
  sessionFromSetCookies,
} from '../_lib/bff-auth';

type LoginBody = {
  email: string;
  password: string;
  deviceDetails?: unknown;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { success: false, message: 'Missing BACKEND_URL', data: null },
      { status: 500 }
    );
  }

  const body = (await req.json()) as LoginBody;

  const backendRes = await fetch(BACKEND_URL + '/api/v1/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const backendBody = await parseBackendBody<{
    user?: unknown;
    permissions?: unknown;
    csrfToken?: string;
  }>(backendRes);

  if (!backendRes.ok) {
    return NextResponse.json(backendBody, { status: backendRes.status });
  }

  const setCookies = getSetCookieArray(backendRes.headers);
  const parsed = sessionFromSetCookies(setCookies);

  const response = NextResponse.json(
    {
      success: true,
      message: backendBody.message || 'Login successful',
      data: {
        user: backendBody.data?.user ?? null,
        permissions: backendBody.data?.permissions ?? null,
      },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );

  applySessionCookies(response, parsed);
  return response;
}



// Section 3: BFF refresh route handler
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  BACKEND_URL,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  applySessionCookies,
  buildBackendCookieHeader,
  clearSessionCookies,
  getSetCookieArray,
  parseBackendBody,
  sessionFromSetCookies,
} from '../_lib/bff-auth';

export async function POST(_req: NextRequest): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { success: false, message: 'Missing BACKEND_URL', data: null },
      { status: 500 }
    );
  }

  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value ?? null;
  const csrfToken = store.get(CSRF_COOKIE)?.value ?? null;

  if (!refreshToken || !csrfToken) {
    const response = NextResponse.json(
      { success: false, message: 'Missing refresh or csrf cookie', data: null },
      { status: 401 }
    );
    clearSessionCookies(response);
    return response;
  }

  const backendRes = await fetch(BACKEND_URL + '/api/v1/admin/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': buildBackendCookieHeader({ refreshToken, csrfToken }),
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  });

  const backendBody = await parseBackendBody(backendRes);

  if (!backendRes.ok) {
    const response = NextResponse.json(backendBody, { status: backendRes.status });
    clearSessionCookies(response);
    return response;
  }

  const setCookies = getSetCookieArray(backendRes.headers);
  const parsed = sessionFromSetCookies(setCookies);

  const response = NextResponse.json(backendBody, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });

  applySessionCookies(response, {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken ?? refreshToken,
    csrfToken: parsed.csrfToken ?? csrfToken,
  });

  return response;
}

// Section 4: generic BFF protected API proxy with auto-refresh
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE,
  BACKEND_URL,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  applySessionCookies,
  buildBackendCookieHeader,
  clearSessionCookies,
  getSetCookieArray,
  parseBackendBody,
  sessionFromSetCookies,
} from '../_lib/bff-auth';

type ProxyBody = {
  backendPath: string;
  payload: unknown;
};

function isAllowedAdminPath(path: string): boolean {
  return path.startsWith('/api/v1/admin/');
}

async function callBackendProtected(backendPath: string, payload: unknown, session: {
  accessToken: string;
  csrfToken: string;
}): Promise<Response> {
  return fetch(BACKEND_URL + backendPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': buildBackendCookieHeader({
        accessToken: session.accessToken,
        csrfToken: session.csrfToken,
      }),
      'x-csrf-token': session.csrfToken,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
}

async function refreshSessionFromBackend(refreshToken: string, csrfToken: string): Promise<{
  ok: boolean;
  response: Response;
  newSession: { accessToken: string | null; refreshToken: string | null; csrfToken: string | null };
}> {
  const refreshRes = await fetch(BACKEND_URL + '/api/v1/admin/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': buildBackendCookieHeader({ refreshToken, csrfToken }),
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  });

  const setCookies = getSetCookieArray(refreshRes.headers);
  const parsed = sessionFromSetCookies(setCookies);

  return {
    ok: refreshRes.ok,
    response: refreshRes,
    newSession: {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken ?? refreshToken,
      csrfToken: parsed.csrfToken ?? csrfToken,
    },
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { success: false, message: 'Missing BACKEND_URL', data: null },
      { status: 500 }
    );
  }

  const body = (await req.json()) as ProxyBody;
  if (!isAllowedAdminPath(body.backendPath)) {
    return NextResponse.json(
      { success: false, message: 'Invalid backend path', data: null },
      { status: 400 }
    );
  }

  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = store.get(REFRESH_COOKIE)?.value ?? null;
  const csrfToken = store.get(CSRF_COOKIE)?.value ?? null;

  if (!accessToken || !refreshToken || !csrfToken) {
    const response = NextResponse.json(
      { success: false, message: 'Missing auth cookies', data: null },
      { status: 401 }
    );
    clearSessionCookies(response);
    return response;
  }

  let protectedRes = await callBackendProtected(body.backendPath, body.payload, {
    accessToken,
    csrfToken,
  });

  if (protectedRes.status === 401) {
    const refreshAttempt = await refreshSessionFromBackend(refreshToken, csrfToken);

    if (!refreshAttempt.ok || !refreshAttempt.newSession.accessToken || !refreshAttempt.newSession.csrfToken) {
      const refreshBody = await parseBackendBody(refreshAttempt.response);
      const failed = NextResponse.json(refreshBody, { status: 401 });
      clearSessionCookies(failed);
      return failed;
    }

    protectedRes = await callBackendProtected(body.backendPath, body.payload, {
      accessToken: refreshAttempt.newSession.accessToken,
      csrfToken: refreshAttempt.newSession.csrfToken,
    });

    const protectedBodyAfterRetry = await parseBackendBody(protectedRes);
    const responseAfterRetry = NextResponse.json(protectedBodyAfterRetry, {
      status: protectedRes.status,
      headers: { 'Cache-Control': 'no-store' },
    });

    applySessionCookies(responseAfterRetry, refreshAttempt.newSession);
    return responseAfterRetry;
  }

  const protectedBody = await parseBackendBody(protectedRes);
  return NextResponse.json(protectedBody, {
    status: protectedRes.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}


// Section 5: logout route handler
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  BACKEND_URL,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  buildBackendCookieHeader,
  clearSessionCookies,
  parseBackendBody,
} from '../_lib/bff-auth';

export async function POST(_req: NextRequest): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { success: false, message: 'Missing BACKEND_URL', data: null },
      { status: 500 }
    );
  }

  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value ?? null;
  const csrfToken = store.get(CSRF_COOKIE)?.value ?? null;

  const backendRes = await fetch(BACKEND_URL + '/api/v1/admin/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': buildBackendCookieHeader({ refreshToken, csrfToken }),
      'x-csrf-token': csrfToken ?? '',
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  });

  const backendBody = await parseBackendBody(backendRes);
  const response = NextResponse.json(backendBody, { status: backendRes.status });
  clearSessionCookies(response);
  return response;
}


// How to call generic protected endpoint from frontend or server component:

// Call your BFF proxy endpoint.
// Send backendPath and payload.
// BFF handles cookies and auto-refresh.
// Example request body:

/*
{
  "backendPath": "/api/v1/admin/reports/some-endpoint",
  "payload": {
    "hostId": 1,
    "filter": {
      "userId": 48,
      "fromDate": 1785781800,
      "tillDate": 1785868199
    }
  }
}
*/