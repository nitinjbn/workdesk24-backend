import { parsePhoneNumberFromString, PhoneNumberType } from 'libphonenumber-js/max';
import { CONFIG } from '../../config/constants';

export interface PhoneValidationResult {
    success: boolean;
    message?: string;

    // Normalized values
    e164?: string;
    country?: string;
    countryCode?: string;
    nationalNumber?: string;

    // Display formats
    international?: string;
    national?: string;

    // Number type
    type?: PhoneNumberType;
}

export class PhoneUtil {

    /**
     * Validate and normalize a phone number.
     *
     * @param mobile Phone number entered by the user
     * @param defaultCountry Default country (e.g. IN)
     */
    static validate(
        mobile: string,
        defaultCountry: 'IN' | 'US' | 'GB' | 'AE' = CONFIG.USER.MOBILE.DEFAULT_COUNTRY as 'IN' | 'US' | 'GB' | 'AE',
        allowedTypes: string[] = CONFIG.USER.MOBILE.ALLOWED_TYPES
    ): PhoneValidationResult {

        if (!mobile || mobile.trim() === '') {
            return {
                success: false,
                message: 'Mobile number is required.'
            };
        }

        mobile = mobile.trim();

        const phone = parsePhoneNumberFromString(mobile, defaultCountry);

        if (!phone) {
            return {
                success: false,
                message: 'Invalid mobile number.'
            };
        }

        if (!phone.isPossible()) {
            return {
                success: false,
                message: 'Mobile number is not possible.'
            };
        }

        if (!phone.isValid()) {
            return {
                success: false,
                message: 'Mobile number is invalid.'
            };
        }

        const phoneType = phone.getType();
         if (!phoneType || !allowedTypes.includes(phoneType)) {
            throw new Error('Only mobile numbers are allowed.');
        }

        return {
            success: true,

            // Save in DB
            e164: phone.number,

            country: phone.country,
            countryCode: phone.countryCallingCode,
            nationalNumber: phone.nationalNumber,

            international: phone.formatInternational(),
            national: phone.formatNational(),

            type: phone.getType()
        };
    }
}