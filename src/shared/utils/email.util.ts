import validator from 'validator';
import dns from 'node:dns/promises';

export enum EmailValidationError {
  EMPTY = 'Email Id is required.',
  INVALID_FORMAT = 'Invalid email format.',
  INVALID_LENGTH = 'Email length exceeds the maximum allowed.',
  DOMAIN_NOT_FOUND = 'Email domain not found.',
  DISPOSABLE_EMAIL = 'Disposable email addresses are not allowed.',
  DNS_LOOKUP_FAILED = 'DNS lookup failed for email domain.'
}

export interface EmailValidationResult {
  isValid: boolean;
  email: string | null;
  localPart: string | null;
  domain: string | null;
  error: EmailValidationError | null;
}

const MAX_EMAIL_LENGTH = 255;

export class EmailUtil {
  /**
   * Normalize email before saving.
   */
  static normalize(email?: string | null): string | null {
    if (!email) return null;

    const normalized = validator.normalizeEmail(email.trim(), {
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false
    });

    return normalized ? normalized.toLowerCase() : null;
  }

  /**
   * Validate email.
   */
  static async validate(
    email?: string | null,
    options?: {
      checkMx?: boolean;
      checkDisposable?: boolean;
    }
  ): Promise<EmailValidationResult> {
    if (!email || !email.trim()) {
      return {
        isValid: false,
        email: null,
        localPart: null,
        domain: null,
        error: EmailValidationError.EMPTY
      };
    }

    const normalized = this.normalize(email);

    if (!normalized) {
      return {
        isValid: false,
        email: null,
        localPart: null,
        domain: null,
        error: EmailValidationError.INVALID_FORMAT
      };
    }

    if (normalized.length > MAX_EMAIL_LENGTH) {
      return {
        isValid: false,
        email: normalized,
        localPart: null,
        domain: null,
        error: EmailValidationError.INVALID_LENGTH
      };
    }

    if (
      !validator.isEmail(normalized, {
        require_tld: true,
        allow_utf8_local_part: false,
        ignore_max_length: false
      })
    ) {
      return {
        isValid: false,
        email: normalized,
        localPart: null,
        domain: null,
        error: EmailValidationError.INVALID_FORMAT
      };
    }

    const [localPart, domain] = normalized.split('@');

    if (options?.checkDisposable) {
      // Add your own disposable domains here or load from a file.
      const disposableDomains = new Set([
        'mailinator.com',
        '10minutemail.com',
        'guerrillamail.com',
        'tempmail.com'
      ]);

      if (disposableDomains.has(domain)) {
        return {
          isValid: false,
          email: normalized,
          localPart,
          domain,
          error: EmailValidationError.DISPOSABLE_EMAIL
        };
      }
    }

    if (options?.checkMx) {
      try {
        const mx = await dns.resolveMx(domain);

        if (!mx.length) {
          return {
            isValid: false,
            email: normalized,
            localPart,
            domain,
            error: EmailValidationError.DOMAIN_NOT_FOUND
          };
        }
      } catch {
        return {
          isValid: false,
          email: normalized,
          localPart,
          domain,
          error: EmailValidationError.DNS_LOOKUP_FAILED
        };
      }
    }

    return {
      isValid: true,
      email: normalized,
      localPart,
      domain,
      error: null
    };
  }
}