import AdminRefreshToken from '../../../models/schemas/AdminRefreshToken';

interface CreateRefreshTokenInput {
  userId: number;
  tokenHash: string;
  tokenFamily: string;
  expiresAt: number;
}

export class AdminRefreshTokenRepository {
  async create(data: CreateRefreshTokenInput): Promise<AdminRefreshToken> {
    return AdminRefreshToken.create(data);
  }

  async findByTokenHash(tokenHash: string): Promise<AdminRefreshToken | null> {
    return AdminRefreshToken.findOne({ where: { tokenHash } });
  }

  async revokeTokenById(id: number, replacedByTokenHash?: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await AdminRefreshToken.update(
      {
        isRevoked: 1,
        revokedAt: now,
        replacedByTokenHash: replacedByTokenHash || null,
      },
      { where: { id } }
    );
  }

  async revokeAllActiveForUser(userId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await AdminRefreshToken.update(
      {
        isRevoked: 1,
        revokedAt: now,
      },
      {
        where: {
          userId,
          isRevoked: 0,
        },
      }
    );
  }
}

export default new AdminRefreshTokenRepository();
