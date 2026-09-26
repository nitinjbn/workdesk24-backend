import { Response, NextFunction } from 'express';
import productService from '../services/product.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import {
  getMediaResourceType,
  uploadBufferToMediaStorage,
} from '../../../shared/utils/media-storage.util';

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
    handler: (
      payload: Record<string, unknown>,
      scope: { hostId: number; requestUserId?: number }
    ) => Promise<unknown>,
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
      const { hostId, productId, mediaType, isPrimary, sortOrder, isEnabled } = req.body;
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'Media file is required',
        } as ApiResponse);
        return;
      }

      const result = await uploadBufferToMediaStorage(file, `${hostId}/products`);
      //console.log('####################### Media uploaded to Cloudinary:', result);

      const saveMedia = await productService.saveProductMedia({
        hostId,
        productId: productId || 0,
        mediaUrl: result.url,
        mediaType: mediaType || getMediaResourceType(file.mimetype).toUpperCase(),
        publicId: result.fileId,
        fileName: file.originalname,
        fileSizeInBytes: file.size,
        mimeType: file.mimetype,
        isPrimary: isPrimary || 0,
        sortOrder: sortOrder || 0,
        isEnabled: isEnabled || 0,
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
          mimeType: saveMedia.mimeType,
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

  async deleteMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, mediaId } = req.body;
      const deleteResult = await productService.deleteProductMedia({ hostId, mediaId });
      res.json({
        success: true,
        message: 'Media deleted successfully',
        data: deleteResult,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async deleteProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, productId } = req.body;
      const deleteResult = await productService.deleteProduct({ hostId, productId });
      res.json({
        success: true,
        message: 'Product deleted successfully',
        data: deleteResult,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }
  async createCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, categoryName } = req.body;
      const createResult = await productService.createCategory({ hostId, categoryName });
      res.json({
        success: true,
        message: 'Category created successfully',
        data: createResult,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async updateCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, categoryId, categoryName } = req.body;
      const updateResult = await productService.updateCategory({
        hostId,
        categoryId,
        categoryName,
      });
      res.json({
        success: true,
        message: 'Category updated successfully',
        data: updateResult,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async deleteCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, categoryId } = req.body;
      const deleteResult = await productService.deleteCategory({ hostId, categoryId });
      res.json({
        success: true,
        message: 'Category deleted successfully',
        data: deleteResult,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async createBrand(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, brandName } = req.body;
      const createResult = await productService.createBrand({ hostId, brandName });
      res.json({
        success: true,
        message: 'Brand created successfully',
        data: createResult,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async updateBrand(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, brandId, brandName } = req.body;
      const updateResult = await productService.updateBrand({
        hostId,
        brandId,
        brandName,
      });
      res.json({
        success: true,
        message: 'Brand updated successfully',
        data: updateResult,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async deleteBrand(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, brandId } = req.body;
      const deleteResult = await productService.deleteBrand({ hostId, brandId });
      res.json({
        success: true,
        message: 'Brand deleted successfully',
        data: deleteResult,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }
}

export default new ProductController();
