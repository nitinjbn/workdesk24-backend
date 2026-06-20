import { Op, WhereOptions } from 'sequelize';
import Role from '../../../models/schemas/Role';

export class RoleRepository {
  async findActiveByHostAndId(hostId: number, roleId: number): Promise<Role | null> {
    return Role.findOne({
      where: {
        hostId,
        id: roleId,
        isDeleted: 0,
        isEnabled: 1,
      } as WhereOptions<Role>,
    });
  }

  async hasRoleCode(hostId: number, roleId: number, roleCode: string): Promise<boolean> {
    const role = await this.findActiveByHostAndId(hostId, roleId);
    if (!role) {
      return false;
    }

    return role.roleCode.toUpperCase() === roleCode.toUpperCase();
  }

  async hasAnyRoleCode(hostId: number, roleId: number, roleCodes: string[]): Promise<boolean> {
    if (!roleCodes.length) {
      return false;
    }

    const normalizedRoleCodes = roleCodes
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length > 0);

    if (!normalizedRoleCodes.length) {
      return false;
    }

    const role = await Role.findOne({
      where: {
        hostId,
        id: roleId,
        isDeleted: 0,
        isEnabled: 1,
        roleCode: {
          [Op.in]: normalizedRoleCodes,
        },
      } as WhereOptions<Role>,
    });

    return !!role;
  }
}

export default new RoleRepository();
