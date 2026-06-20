import UserPermission from '../../../models/schemas/UserPermission';
import Permission from '../../../models/schemas/Permission';

export interface UserPermissionAssignmentView {
  id: number;
  permissionCode: string;
  permissionName: string;
  moduleName: string;
  isEnabled: number;
}

export class UserPermissionRepository {
  async getPermissionsByUser(hostId: number, userId: number): Promise<UserPermissionAssignmentView[]> {
    const rows = await UserPermission.findAll({
      where: {
        hostId,
        userId,
        isDeleted: 0,
      },
      include: [
        {
          model: Permission,
          as: 'permission',
          required: true,
          where: {
            isEnabled: 1,
            isDeleted: 0,
          },
          attributes: ['id', 'permissionCode', 'permissionName', 'moduleName'],
        },
      ],
      order: [[{ model: Permission, as: 'permission' }, 'moduleName', 'ASC'], [{ model: Permission, as: 'permission' }, 'permissionCode', 'ASC']],
    });

    return rows
      .map((row) => {
        const permission = (row as any).permission as Permission | undefined;
        if (!permission || !permission.id) {
          return null;
        }

        const isEnabled = Number((row as any).isEnabled ?? 0);

        return {
          id: Number(permission.id),
          permissionCode: permission.permissionCode,
          permissionName: permission.permissionName,
          moduleName: permission.moduleName,
          isEnabled: isEnabled === 1 ? 1 : 0,
        };
      })
      .filter((item): item is UserPermissionAssignmentView => item !== null);
  }
}

export default new UserPermissionRepository();
