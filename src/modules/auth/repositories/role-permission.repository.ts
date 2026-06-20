import RolePermission from '../../../models/schemas/RolePermission';
import Permission from '../../../models/schemas/Permission';

export interface RolePermissionView {
  id: number;
  permissionCode: string;
  permissionName: string;
  moduleName: string;
}

export class RolePermissionRepository {
  async getEnabledPermissionsByRole(hostId: number, roleId: number): Promise<RolePermissionView[]> {
    const rows = await RolePermission.findAll({
      where: {
        hostId,
        roleId,
        isEnabled: 1,
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

        return {
          id: Number(permission.id),
          permissionCode: permission.permissionCode,
          permissionName: permission.permissionName,
          moduleName: permission.moduleName,
        };
      })
      .filter((item): item is RolePermissionView => item !== null);
  }
}

export default new RolePermissionRepository();
