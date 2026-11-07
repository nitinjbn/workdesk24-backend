export interface CorsPolicy {
  allowedOrigins: string[];
  allowedSubdomainDomains: string[];
  credentials: true;
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allowed?: boolean) => void
  ) => void;
}

export const parseCorsOrigins = (value: string | undefined): string[] => {
  const entries = value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) || [];

  for (const origin of entries) {
    if (origin.includes('*')) {
      throw new Error('CORS_ORIGINS must not contain wildcard origins when credentials are enabled');
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      throw new Error(`CORS_ORIGINS must contain origins without paths or credentials: ${origin}`);
    }
  }

  return [...new Set(entries)];
};

const isDnsDomain = (domain: string): boolean =>
  domain.length <= 253 &&
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain);

export const parseCorsSubdomainDomains = (value: string | undefined): string[] => {
  const domains = value?.split(',').map((domain) => domain.trim().toLowerCase()).filter(Boolean) || [];
  for (const domain of domains) {
    if (!isDnsDomain(domain)) {
      throw new Error('CORS_SUBDOMAIN_DOMAINS must contain DNS domains without schemes, wildcards, paths or ports');
    }
  }
  return [...new Set(domains)];
};

const isAllowedSubdomainOrigin = (origin: string, domains: string[]): boolean => {
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin &&
      parsed.protocol === 'https:' &&
      parsed.port === '' &&
      isDnsDomain(parsed.hostname) &&
      domains.some((domain) => parsed.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

export const createCorsPolicy = (
  environment: string | undefined,
  configuredOrigins: string | undefined,
  configuredSubdomainDomains?: string
): CorsPolicy => {
  const allowedOrigins = parseCorsOrigins(configuredOrigins);
  const allowedSubdomainDomains = parseCorsSubdomainDomains(configuredSubdomainDomains);
  const hasAllowlist = allowedOrigins.length > 0 || allowedSubdomainDomains.length > 0;
  if (environment === 'production' && !hasAllowlist) {
    throw new Error('CORS configuration must contain at least one explicit origin or an approved subdomain domain in production');
  }

  return {
    allowedOrigins,
    allowedSubdomainDomains,
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || !hasAllowlist || allowedOrigins.includes(origin) || isAllowedSubdomainOrigin(origin, allowedSubdomainDomains)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS policy'));
    },
  };
};