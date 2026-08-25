import leaveTypeRepository from '../repositories/leave-type.repository';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';

const BOOLEAN_FLAGS = [0, 1];

export class LeaveTypeService {
  private validateBooleanFlag(value: any): boolean {
    return BOOLEAN_FLAGS.includes(value);
  }

  private validateHexColor(color: string): boolean {
    // Validate hex color format (#RRGGBB or #RGB)
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  async getLeaveTypes(payload: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = payload;

    const report = await leaveTypeRepository.getLeaveTypes({
      hostId,
      filter,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      leaveTypes: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getLeaveTypeById(payload: {
    hostId: number;
    leaveTypeId: number;
  }): Promise<any> {
    const { hostId, leaveTypeId } = payload;

    const leaveType = await leaveTypeRepository.getLeaveTypeById(hostId, leaveTypeId);

    if (!leaveType) {
      throw createConfiguredError(
        'LEAVE_TYPE_NOT_FOUND',
        'Leave type not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      leaveType && typeof leaveType.toJSON === 'function'
        ? leaveType.toJSON()
        : leaveType;

    return {
      leaveType: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async createLeaveType(payload: {
    hostId: number;
    name: string;
    code: string;
    description?: string;
    isPaid?: number;
    allowHalfDay?: number;
    allowPastDate?: number;
    allowFutureDate?: number;
    requiresDocument?: number;
    documentAfterDays?: number;
    color?: string;
  }): Promise<any> {
    const {
      hostId,
      name,
      code,
      description,
      isPaid,
      allowHalfDay,
      allowPastDate,
      allowFutureDate,
      requiresDocument,
      documentAfterDays,
      color,
    } = payload;

    // Validation
    if (!name || !code) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'Leave type name and code are required',
        400
      );
    }

    // Validate name length
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw createConfiguredError(
        'INVALID_LEAVE_TYPE_NAME',
        'Leave type name must be 1-100 characters',
        400
      );
    }

    // Validate code length and format
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length === 0 || trimmedCode.length > 50) {
      throw createConfiguredError(
        'INVALID_LEAVE_TYPE_CODE',
        'Leave type code must be 1-50 characters',
        400
      );
    }

    // Check for duplicate code per host
    const existingCode = await leaveTypeRepository.getLeaveTypeByCode(hostId, trimmedCode);
    if (existingCode) {
      throw createConfiguredError(
        'DUPLICATE_LEAVE_TYPE_CODE',
        'A leave type with this code already exists',
        400
      );
    }

    // Validate boolean flags
    if (isPaid !== undefined && !this.validateBooleanFlag(isPaid)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'isPaid must be 0 or 1',
        400
      );
    }
    if (allowHalfDay !== undefined && !this.validateBooleanFlag(allowHalfDay)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'allowHalfDay must be 0 or 1',
        400
      );
    }
    if (allowPastDate !== undefined && !this.validateBooleanFlag(allowPastDate)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'allowPastDate must be 0 or 1',
        400
      );
    }
    if (allowFutureDate !== undefined && !this.validateBooleanFlag(allowFutureDate)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'allowFutureDate must be 0 or 1',
        400
      );
    }
    if (requiresDocument !== undefined && !this.validateBooleanFlag(requiresDocument)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'requiresDocument must be 0 or 1',
        400
      );
    }

    // Validate documentAfterDays when requiresDocument is enabled
    if (requiresDocument === 1) {
      if (documentAfterDays === undefined || documentAfterDays === null) {
        throw createConfiguredError(
          'DOCUMENT_AFTER_DAYS_REQUIRED',
          'documentAfterDays is required when requiresDocument is enabled',
          400
        );
      }

      if (!Number.isInteger(documentAfterDays) || documentAfterDays <= 0 || documentAfterDays > 365) {
        throw createConfiguredError(
          'INVALID_DOCUMENT_AFTER_DAYS',
          'documentAfterDays must be an integer between 1 and 365',
          400
        );
      }
    }

    // Validate color if provided
    if (color !== undefined && color !== null && color !== '') {
      const trimmedColor = color.trim();
      if (!this.validateHexColor(trimmedColor)) {
        throw createConfiguredError(
          'INVALID_COLOR',
          'Color must be a valid hex color code (#RRGGBB or #RGB)',
          400
        );
      }
    }

    // Create leave type
    const leaveType = await leaveTypeRepository.createLeaveType(hostId, {
      name: trimmedName,
      code: trimmedCode,
      description: description?.trim(),
      isPaid,
      allowHalfDay,
      allowPastDate,
      allowFutureDate,
      requiresDocument,
      documentAfterDays,
      color: color?.trim(),
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      leaveType && typeof leaveType.toJSON === 'function'
        ? leaveType.toJSON()
        : leaveType;

    return {
      leaveType: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async updateLeaveType(payload: {
    hostId: number;
    leaveTypeId: number;
    name?: string;
    code?: string;
    description?: string;
    isPaid?: number;
    allowHalfDay?: number;
    allowPastDate?: number;
    allowFutureDate?: number;
    requiresDocument?: number;
    documentAfterDays?: number;
    color?: string;
  }): Promise<any> {
    const {
      hostId,
      leaveTypeId,
      name,
      code,
      description,
      isPaid,
      allowHalfDay,
      allowPastDate,
      allowFutureDate,
      requiresDocument,
      documentAfterDays,
      color,
    } = payload;

    // Check if leave type exists
    const existingLeaveType = await leaveTypeRepository.getLeaveTypeById(hostId, leaveTypeId);

    if (!existingLeaveType) {
      throw createConfiguredError(
        'LEAVE_TYPE_NOT_FOUND',
        'Leave type not found',
        404
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        throw createConfiguredError(
          'INVALID_LEAVE_TYPE_NAME',
          'Leave type name must be 1-100 characters',
          400
        );
      }
      updateData.name = trimmedName;
    }

    if (code !== undefined) {
      const trimmedCode = code.trim().toUpperCase();
      if (trimmedCode.length === 0 || trimmedCode.length > 50) {
        throw createConfiguredError(
          'INVALID_LEAVE_TYPE_CODE',
          'Leave type code must be 1-50 characters',
          400
        );
      }

      // Check for duplicate code (excluding current leave type)
      const duplicateCode = await leaveTypeRepository.getLeaveTypeByCode(
        hostId,
        trimmedCode,
        leaveTypeId
      );

      if (duplicateCode) {
        throw createConfiguredError(
          'DUPLICATE_LEAVE_TYPE_CODE',
          'A leave type with this code already exists',
          400
        );
      }

      updateData.code = trimmedCode;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (isPaid !== undefined && !this.validateBooleanFlag(isPaid)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'isPaid must be 0 or 1',
        400
      );
    }
    if (isPaid !== undefined) {
      updateData.isPaid = isPaid;
    }

    if (allowHalfDay !== undefined && !this.validateBooleanFlag(allowHalfDay)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'allowHalfDay must be 0 or 1',
        400
      );
    }
    if (allowHalfDay !== undefined) {
      updateData.allowHalfDay = allowHalfDay;
    }

    if (allowPastDate !== undefined && !this.validateBooleanFlag(allowPastDate)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'allowPastDate must be 0 or 1',
        400
      );
    }
    if (allowPastDate !== undefined) {
      updateData.allowPastDate = allowPastDate;
    }

    if (allowFutureDate !== undefined && !this.validateBooleanFlag(allowFutureDate)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'allowFutureDate must be 0 or 1',
        400
      );
    }
    if (allowFutureDate !== undefined) {
      updateData.allowFutureDate = allowFutureDate;
    }

    if (requiresDocument !== undefined && !this.validateBooleanFlag(requiresDocument)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'requiresDocument must be 0 or 1',
        400
      );
    }
    if (requiresDocument !== undefined) {
      updateData.requiresDocument = requiresDocument;
    }

    // Validate documentAfterDays based on new or existing requiresDocument value
    const finalRequiresDocument =
      requiresDocument !== undefined ? requiresDocument : (existingLeaveType as any).requiresDocument;

    if (finalRequiresDocument === 1) {
      const finalDocumentAfterDays =
        documentAfterDays !== undefined ? documentAfterDays : (existingLeaveType as any).documentAfterDays;

      if (finalDocumentAfterDays === undefined || finalDocumentAfterDays === null) {
        throw createConfiguredError(
          'DOCUMENT_AFTER_DAYS_REQUIRED',
          'documentAfterDays is required when requiresDocument is enabled',
          400
        );
      }

      if (
        !Number.isInteger(finalDocumentAfterDays) ||
        finalDocumentAfterDays <= 0 ||
        finalDocumentAfterDays > 365
      ) {
        throw createConfiguredError(
          'INVALID_DOCUMENT_AFTER_DAYS',
          'documentAfterDays must be an integer between 1 and 365',
          400
        );
      }

      if (documentAfterDays !== undefined) {
        updateData.documentAfterDays = documentAfterDays;
      }
    } else if (documentAfterDays !== undefined) {
      // If requiresDocument is false, documentAfterDays should be null
      updateData.documentAfterDays = null;
    }

    if (color !== undefined) {
      if (color === null || color === '') {
        updateData.color = null;
      } else {
        const trimmedColor = color.trim();
        if (!this.validateHexColor(trimmedColor)) {
          throw createConfiguredError(
            'INVALID_COLOR',
            'Color must be a valid hex color code (#RRGGBB or #RGB)',
            400
          );
        }
        updateData.color = trimmedColor;
      }
    }

    // Update leave type
    const updatedLeaveType = await leaveTypeRepository.updateLeaveType(
      hostId,
      leaveTypeId,
      updateData
    );

    if (!updatedLeaveType) {
      throw createConfiguredError(
        'LEAVE_TYPE_NOT_FOUND',
        'Leave type not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      updatedLeaveType && typeof updatedLeaveType.toJSON === 'function'
        ? updatedLeaveType.toJSON()
        : updatedLeaveType;

    return {
      leaveType: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async enableDisableLeaveType(payload: {
    hostId: number;
    leaveTypeId: number;
    isEnabled: number;
  }): Promise<any> {
    const { hostId, leaveTypeId, isEnabled } = payload;

    // Validation
    if (!this.validateBooleanFlag(isEnabled)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'isEnabled must be 0 or 1',
        400
      );
    }

    // Check if leave type exists
    const existingLeaveType = await leaveTypeRepository.getLeaveTypeById(hostId, leaveTypeId);

    if (!existingLeaveType) {
      throw createConfiguredError(
        'LEAVE_TYPE_NOT_FOUND',
        'Leave type not found',
        404
      );
    }

    // Enable/disable leave type
    const updatedLeaveType = await leaveTypeRepository.enableDisableLeaveType(
      hostId,
      leaveTypeId,
      isEnabled
    );

    if (!updatedLeaveType) {
      throw createConfiguredError(
        'LEAVE_TYPE_NOT_FOUND',
        'Leave type not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      updatedLeaveType && typeof updatedLeaveType.toJSON === 'function'
        ? updatedLeaveType.toJSON()
        : updatedLeaveType;

    return {
      leaveType: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async deleteLeaveType(payload: {
    hostId: number;
    leaveTypeId: number;
  }): Promise<any> {
    const { hostId, leaveTypeId } = payload;

    // Check if leave type exists
    const existingLeaveType = await leaveTypeRepository.getLeaveTypeById(hostId, leaveTypeId);

    if (!existingLeaveType) {
      throw createConfiguredError(
        'LEAVE_TYPE_NOT_FOUND',
        'Leave type not found',
        404
      );
    }

    // Check for dependent records
    const dependents = await leaveTypeRepository.checkDependentRecords(hostId, leaveTypeId);

    if (dependents.hasDependents) {
      throw createConfiguredError(
        'LEAVE_TYPE_HAS_DEPENDENTS',
        `Cannot delete leave type. Found ${dependents.details.policyRules} policy rule(s), ${dependents.details.leaveRequests} leave request(s), and ${dependents.details.leaveBalances} leave balance record(s). Consider disabling the leave type instead.`,
        400
      );
    }

    // Delete leave type (soft delete)
    const deleted = await leaveTypeRepository.deleteLeaveType(hostId, leaveTypeId);

    if (!deleted) {
      throw createConfiguredError(
        'LEAVE_TYPE_NOT_FOUND',
        'Leave type not found',
        404
      );
    }

    return { success: true };
  }
}

export default new LeaveTypeService();
