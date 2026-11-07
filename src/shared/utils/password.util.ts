const MIN_PASSWORD_LENGTH = 6;

export interface PasswordPatternResult {
  isValid: boolean;
  errors: string[];
}

export const validatePasswordPattern = (password: string): PasswordPatternResult => {
  const errors: string[] = [];

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('must contain at least one special character');
  }

  return { isValid: errors.length === 0, errors };
};
