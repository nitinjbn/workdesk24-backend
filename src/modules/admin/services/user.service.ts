import userRepository from '../../auth/repositories/user.repository';
import { PaginationParams } from '../../../shared/types/base.types';

export class UserService {
  async getAllUsers(params: PaginationParams) {
    return userRepository.paginate(params);
  }

  async getUserById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateUser(id: number, data: { email?: string; name?: string }) {
    const user = await userRepository.update(id, data as any);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async deleteUser(id: number, requestUserId: number) {
    if (id === requestUserId) {
      throw new Error('Cannot delete your own account');
    }

    const success = await userRepository.delete(id);
    if (!success) {
      throw new Error('User not found');
    }

    return { success: true };
  }
}

export default new UserService();
