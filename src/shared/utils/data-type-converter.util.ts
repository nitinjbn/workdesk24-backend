/**
 * Define which fields should be converted to specific types
 * This ensures BIGINT and numeric fields are properly typed in JSON responses
 */
export const NUMERIC_FIELD_CONFIG: Record<string, 'number' | 'bigint'> = {
  // Primary keys and IDs
  id: 'bigint',
  hostId: 'bigint',
  roleId: 'bigint',
  designationId: 'bigint',
  userId: 'bigint',
  reportingManagerId: 'bigint',
  customerTypeId: 'bigint',
  customerId: 'bigint',
  parentCustomerId: 'bigint',
  mediaId: 'bigint',
  // Visit and order related fields
  visitId: 'bigint',
  orderId: 'bigint',
  paymentId: 'bigint',
  feedbackId: 'bigint',
  imageId: 'bigint',
  productId: 'bigint',

  // Timestamps (stored as Unix timestamps)
  createdAt: 'bigint',
  updatedAt: 'bigint',
  isDeleted: 'number',
  deletedAt: 'bigint',
  mobileVerifiedAt: 'bigint',
  accountStatusUpdatedAt: 'bigint',
  lastLoginAt: 'bigint',
  dateOfBirth: 'bigint',
  joiningDate: 'bigint',
  mobileVerified: 'number',

  // Settings and other numeric fields
  isEnabled: 'number',
};

/**
 * Convert numeric string fields to actual numbers based on config
 * This handles Sequelize's behavior of serializing BIGINT as strings
 */
export function convertNumericFields(data: any, fieldConfig: Record<string, 'number' | 'bigint'> = NUMERIC_FIELD_CONFIG): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => convertNumericFields(item, fieldConfig));
  }

  const converted: any = { ...data };

  Object.entries(data).forEach(([key, value]) => {
    // Recursively convert nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      converted[key] = convertNumericFields(value, fieldConfig);
      return;
    }

    // Recursively convert arrays
    if (Array.isArray(value)) {
      converted[key] = value.map(item => 
        typeof item === 'object' ? convertNumericFields(item, fieldConfig) : item
      );
      return;
    }

    // Convert numeric strings to numbers if field is in config
    if (fieldConfig[key] && typeof value === 'string' && /^\d+$/.test(value)) {
      converted[key] = parseInt(value, 10);
    }
  });

  return converted;
}

export default {
  convertNumericFields,
  NUMERIC_FIELD_CONFIG,
};
