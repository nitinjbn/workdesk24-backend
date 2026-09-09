import { Request, Response, NextFunction } from 'express';
import inquiryService from '../services/inquiry.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { PhoneUtil } from '../../../shared/utils/phone.util';
import { EmailUtil } from '../../../shared/utils/email.util';
import inquiryNotificationService from '../../../modules/notifications/NotificationFacade';

export class InquiryController {
  async createInquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, countryIsoCode = 'IN', mobile, subject, message, source } = req.body;
      const ipAddress = req.ip || '0.0.0.0';
      const userAgent = req.get('user-agent') ?? '';

      const validationResult = PhoneUtil.validate(mobile, countryIsoCode);
      console.log('############# Phone validation result:', validationResult);

      if (!validationResult.success) {
        throw new Error(validationResult.message || 'Invalid mobile number');
      }

      const emailValidationResult = await EmailUtil.validate(email, {
        checkMx: true,
        checkDisposable: true,
      });
      if (!emailValidationResult.isValid) {
        throw new Error(emailValidationResult.error || 'Invalid email address');
      }

      if (!name?.trim() || !email?.trim() || !mobile?.trim() || !message?.trim()) {
        res.status(400).json({
          success: false,
          message: 'Name, email, mobile, and message are required',
        } as ApiResponse);
        return;
      }

      await inquiryService.createInquiry({
        name,
        email,
        mobile: validationResult.e164,
        ipAddress,
        userAgent,
        source,
        subject,
        message,
      });

      // Send notification email to sales team
      const sendEmailResult = await inquiryNotificationService.sendSubmittedInquiryEmailToSalesTeam(
        {
          name,
          email,
          mobile: validationResult.e164,
          countryIsoCode,
          message,
          source,
        }
      );
      console.log('############# Send email result:', sendEmailResult);

      res.status(201).json({
        success: true,
        message: 'Inquiry submitted successfully',
        data: {},
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getAllInquiries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10 } = req.body;

      const result = await inquiryService.getAllInquiries({
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
      });

      res.json({
        success: true,
        message: 'Inquiries retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getInquiryById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.body;

      const inquiry = await inquiryService.getInquiryById(id);

      res.json({
        success: true,
        message: 'Inquiry retrieved successfully',
        data: inquiry,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateInquiryStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, status } = req.body;

      const inquiry = await inquiryService.updateInquiryStatus(id, status);

      res.json({
        success: true,
        message: 'Inquiry status updated successfully',
        data: inquiry,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateInquiry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, priority, adminNotes } = req.body;

      const inquiry = await inquiryService.updateInquiry(id, { priority, adminNotes });

      res.json({
        success: true,
        message: 'Inquiry updated successfully',
        data: inquiry,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async assignInquiry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, adminId } = req.body;

      const inquiry = await inquiryService.assignInquiry(id, adminId);

      res.json({
        success: true,
        message: 'Inquiry assigned successfully',
        data: inquiry,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteInquiry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.body;

      await inquiryService.deleteInquiry(id);

      res.json({
        success: true,
        message: 'Inquiry deleted successfully',
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new InquiryController();
