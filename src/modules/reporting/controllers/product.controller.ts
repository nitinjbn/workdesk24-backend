import { Response, NextFunction } from 'express';
import productService from '../services/product.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';

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
}

export default new ProductController();