import { Response, NextFunction } from 'express';
import customerService from '../services/customer.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import {
  getMediaResourceType,
  uploadBufferToMediaStorage,
} from '../../../shared/utils/media-storage.util';

export class CustomerController {
  async getCustomerTypes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, filter, page, limit, sorting } = req.body;
    try {
      const result = await customerService.getCustomerTypes({ hostId, filter, page, limit, sorting }, { hostId: req.user!.hostId });
      res.json({
        success: true,
        message: 'Customer types retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getCustomers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, filter, page, limit, sorting } = req.body;
    try {
      const result = await customerService.getCustomers({ hostId, filter, page, limit, sorting }, { hostId: req.user!.hostId });
      res.json({
        success: true,
        message: 'Customers retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getCustomerDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, customerId } = req.body;
    try {
      const result = await customerService.getCustomerDetails({ hostId, customerId }, { hostId: req.user!.hostId });
      res.json({
        success: true,
        message: 'Customer details retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createCustomer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, customerCode, customerName, customerTypeId, contactPerson, email, mobile, alternateMobile, gstNumber, panNumber, addressLine1, addressLine2, city, stateName, stateIsoCode, postalCode, countryName, countryIsoCode, remarks, isEnabled, customerMedia = [], customerAttribute = [] } = req.body;
    try {
      const result = await customerService.createCustomer({ hostId, customerCode, customerName, customerTypeId, contactPerson, email, mobile, alternateMobile, gstNumber, panNumber, addressLine1, addressLine2, city, stateName, stateIsoCode, postalCode, countryName, countryIsoCode, remarks, isEnabled, customerMedia, customerAttribute });
      res.json({
        success: true,
        message: 'Customer created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }


  async updateCustomer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, customerId, customerCode, customerName, customerTypeId, contactPerson, email, mobile, alternateMobile, gstNumber, panNumber, addressLine1, addressLine2, city, stateName, stateIsoCode, postalCode, countryName, countryIsoCode, remarks, isEnabled, customerMedia = [], customerAttribute = [] } = req.body;
    try {
      const result = await customerService.updateCustomer({ hostId, customerId, customerCode, customerName, customerTypeId, contactPerson, email, mobile, alternateMobile, gstNumber, panNumber, addressLine1, addressLine2, city, stateName, stateIsoCode, postalCode, countryName, countryIsoCode, remarks, isEnabled, customerMedia, customerAttribute });
      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /*
  async getBrands(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.getBrands(payload as any, scope),
      'Product brands retrieved successfully'
    );
  }

  async getUOM(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.getUOM(payload as any, scope),
      'Product UOM retrieved successfully'
    );
  }
  
  async getProducts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.getProducts(payload as any, scope),
      'Products retrieved successfully'
    );
  }

  async getProductDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.getProductDetails(payload as any, scope),
      'Product details retrieved successfully'
    );
  }

  async getProductMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.getProductMedia(payload as any, scope),
      'Product media retrieved successfully'
    );
  }

  async getProductAttributes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.getProductAttributes(payload as any, scope),
      'Product attributes retrieved successfully'
    );
  }

  private async executeUserScopedReport(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
    handler: (payload: Record<string, unknown>, scope: { hostId: number; requestUserId?: number }) => Promise<unknown>,
    successMessage: string,
    restrictToSelf = false
  ): Promise<void> {
    try {
      const result = await handler(req.body as Record<string, unknown>, {
        hostId: req.user!.hostId,
        requestUserId: restrictToSelf ? req.user!.id : undefined,
      });

      res.json({
        success: true,
        message: successMessage,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
  */

  async uploadMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, customerId, mediaType, isPrimary, sortOrder, isEnabled } =  req.body;
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'Media file is required',
        } as ApiResponse);
        return;
      }

      const result = await uploadBufferToMediaStorage(file, `${hostId}/customers`);
      //console.log('####################### Media uploaded to Cloudinary:', result);

      const saveMedia = await customerService.saveCustomerMedia({
        hostId,
        customerId: customerId || 0,
        mediaUrl: result.url,
        mediaType: mediaType || getMediaResourceType(file.mimetype).toUpperCase(),
        publicId: result.fileId,
        fileName: file.originalname,
        fileSizeInBytes: file.size,
        mimeType: file.mimetype,
        isPrimary: isPrimary || 0,
        sortOrder: sortOrder || 0,
        isEnabled: isEnabled || 0
      });
      //console.log('####################### Media saved to database:', saveMedia);

      res.json({
        success: true,
        message: 'Media uploaded successfully',
        data: {
          url: result.url,
          public_id: result.fileId,
          mediaId: saveMedia.id,
          isTemporary: Number(!saveMedia.isEnabled),
          isPrimary: saveMedia.isPrimary,
          fileName: saveMedia.fileName,
          fileSizeInBytes: saveMedia.fileSizeInBytes,
          mimeType: saveMedia.mimeType
        },
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error uploading media',
        error: error.message,
      } as ApiResponse);
    }
  }

  /*
  async createProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.createProduct(payload as any, scope),
      'Product created successfully'
    );
  }

  async updateProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.updateProduct(payload as any, scope),
      'Product updated successfully'
    );
  }
  */

  async deleteMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, mediaId } = req.body;
      const deleteResult = await customerService.deleteCustomerMedia({ hostId, mediaId });
      res.json({
        success: true,
        message: 'Media deleted successfully',
        data: deleteResult,
      } as ApiResponse);

    } catch (error: any) {
      next(error);
    }
  }

  
  async deleteCustomer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, customerId } = req.body;
      const deleteResult = await customerService.deleteCustomer({ hostId, customerId });
      res.json({
        success: true,
        message: 'Customer deleted successfully',
        data: deleteResult,
      } as ApiResponse);

    } catch (error: any) {
      next(error);
    }
  }
}

export default new CustomerController();