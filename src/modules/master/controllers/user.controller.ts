import { Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { GetUsersPayload } from '../types/master.types';
import userService from '../services/user.service';
import { uploadBufferToMediaStorage } from '../../../shared/utils/media-storage.util';
export class UserController {

  async getAppUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getAppUsers(payload as GetUsersPayload, scope),
      'Users retrieved successfully'
    );
  }

  async getUserDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getUserDetails(payload as any, scope),
      'User details retrieved successfully'
    );
  }

  async getDesignations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getDesignations(payload as any, scope),
      'Designations retrieved successfully'
    );
  }

  async getRoles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getRoles(payload as any, scope),
      'Roles retrieved successfully'
    );
  }

  async getRoleDetailsById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getRoleDetailsById(payload as any, scope),
      'Role details retrieved successfully'
    );
  }

  async getRoleDetailsByCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getRoleDetailsByCode(payload as any, scope),
      'Role details retrieved successfully'
    );
  }

  async createAppUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, name, email, employeeCode, mobile, password, reportingManagerId, roleId, designationId, joiningDate, isActive } =  req.body;
      const file = req.file as Express.Multer.File | undefined;

      let profileImageUrl = "";
      if(file) {
        const result = await uploadBufferToMediaStorage(file, `${hostId}/users`);
        console.log('####################### Media uploaded to Cloudinary:', result);
        profileImageUrl = result.url;
      }      

      const createUserResult = await userService.createAppUser({
        hostId,
        name,
        email,
        employeeCode,
        mobile,
        password,
        reportingManagerId,
        roleId,
        designationId,
        profileImageUrl,
        joiningDate,
        isActive
      });
      console.log('####################### createUserResult:', createUserResult);

      res.json({
        success: true,
        message: 'User created successfully',
        data: {
          userId: createUserResult.id,
          name: createUserResult.name,
          employeeCode: createUserResult.employeeCode,
          email: createUserResult.email,
          mobile: createUserResult.mobile,
          profileImageUrl: createUserResult.profileImageUrl,
        },
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error creating user',
        error: error.message,
      } as ApiResponse);
    }
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

export default new UserController();