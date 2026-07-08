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
}