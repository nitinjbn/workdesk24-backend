import { EmailUtil } from './email.util';
import { PhoneUtil } from './phone.util';
import crypto from 'crypto';
export class CommonUtil {
    static convertSettingsToArray(settings: Record<string, any>): Array<{ settingName: string; settingValue: string }> {
        if (!settings || typeof settings !== 'object') {
            return [];
        }
        return Object.entries(settings).map(([settingName, settingValue]) => ({
            settingName,
            settingValue:
            typeof settingValue === 'object'
            ? JSON.stringify(settingValue)
            : String(settingValue)
        }));
    }

    static convertSettingsToObject(settingsArray: Array<{ settingName: string; settingValue: any }>): Record<string, any> {
        if (!Array.isArray(settingsArray)) {
            return {};
        }
        return settingsArray.reduce((result, { settingName, settingValue }) => {
            let value:any = settingValue;

            // Try to parse JSON (arrays/objects)
            try {
                value = JSON.parse(settingValue);
            } catch (_) {
                // Convert primitive values
                if (settingValue === 'true') {
                    value = true;
                } else if (settingValue === 'false') {
                    value = false;
                } else if (!isNaN(settingValue) && settingValue.trim() !== '') {
                    value = Number(settingValue);
                }
            }

            result[settingName] = value;
            return result;
        }, {});
    }

    static parseJsonField(value: string, defaultValue: any = {}): any {
        if (!value) return defaultValue;
        try {
            return JSON.parse(value);
        } catch {
            return defaultValue;
        }
    }

    static parseIdentifier(identifier: string): any {
        const value = identifier.trim();

        // Email
        const parseEmailResult = EmailUtil.parseEmail(value);
        if (parseEmailResult.isValid) {
            return {
                type: 'EMAIL',
                email: parseEmailResult.email
            };
        }

        // Mobile
        const parseMobileResult = PhoneUtil.parseMobileNumber(value);
        if (parseMobileResult.isValid) {
            return {
                type: 'MOBILE',
                mobile: parseMobileResult.mobile
            };
        }

        return {
            type: null,
            email: null,
            mobile: null
        };
    }

    /**
   * Generate a cryptographically secure numeric OTP.
   *
   * @param length OTP length (default: 6)
   * @returns Numeric OTP as a string
   */
  static generateOTP(length: number = 6): string {
    if (length < 4 || length > 10) {
      throw new Error('OTP length must be between 4 and 10 digits.');
    }

    const min = 10 ** (length - 1);
    const max = (10 ** length) - 1;

    return crypto.randomInt(min, max + 1).toString();
  }
}