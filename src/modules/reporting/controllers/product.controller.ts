import { Response, NextFunction } from 'express';
import productService from '../services/product.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import cloudinary from '../../../config/cloudinary';

export class ProductController {
  async getCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.getCategories(payload as any, scope),
      'Product categories retrieved successfully'
    );
  }

  async getBrands(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => productService.getBrands(payload as any, scope),
      'Product brands retrieved successfully'
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

  async uploadMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, productId, mediaType, isPrimary, sortOrder, isEnabled } =  req.body;
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'Media file is required',
        } as ApiResponse);
        return;
      }

      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: `${hostId}/products`, resource_type: this.getResourceType(file.mimetype) },
          (error: any, uploadResult: any) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(uploadResult);
          }
        );

        uploadStream.end(file.buffer);
      });
      console.log('####################### Media uploaded to Cloudinary:', result);

      const saveMedia = await productService.saveProductMedia({
        hostId,
        productId: productId || 0,
        mediaUrl: result.secure_url,
        mediaType: mediaType || this.getResourceType(file.mimetype).toUpperCase(),
        publicId: result.public_id,
        fileName: file.originalname,
        fileSizeInBytes: file.size,
        mimeType: file.mimetype,
        isPrimary: isPrimary,
        sortOrder: sortOrder,
        isEnabled: isEnabled || 0
      });
      console.log('####################### Media saved to database:', saveMedia);

      res.json({
        success: true,
        message: 'Media uploaded successfully',
        data: {
          url: result.secure_url,
          public_id: result.public_id,
          mediaId: saveMedia.id,
          isTemporary: !saveMedia.isEnabled,
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

  private getResourceType(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'video'; // Treat audio as video for Cloudinary
    } else {
      return 'auto'; // Let cloudinary handle
    }
  }
}

export default new ProductController();