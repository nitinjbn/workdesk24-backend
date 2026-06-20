import jwt from 'jsonwebtoken';
import userRepository from '../repositories/user.repository';
import bcrypt from 'bcryptjs';

interface RegisterDto {
  hostId?: number;
  email: string;
  password: string;
  name?: string;
  roleId?: number;
  mobile?: string;
  employeeId?: string;
  reportingManagerId?: number;
  profileImageUrl?: string;
  joiningDate?: number;
}

interface LoginDto {
  email: string;
  password: string;
}

interface AuthResponse {
  user: any;
  token: string;
}

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponse> {
    const { hostId, email, password, name, roleId, mobile, employeeId, reportingManagerId, profileImageUrl, joiningDate } = data;

    const exists = await userRepository.existsByEmail(email);
    if (exists) {
      throw new Error('Email already registered');
    }

    const user = await userRepository.create({
      hostId,
      email,
      password,
      name,
      roleId,
      mobile,
      employeeId,
      reportingManagerId,
      profileImageUrl,
      joiningDate,
    } as any);

    const token = this.generateToken(user.id);

    return {
      user: user.toJSON(),
      token,
    };
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    const { email, password } = data;

    const user = await userRepository.findWithPassword(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user.id);

    return {
      user: user.toJSON(),
      token,
    };
  }

  private generateToken(userId: number): string {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

    return jwt.sign({ userId }, secret, { expiresIn });
  }

  verifyToken(token: string): { userId: number } {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    return jwt.verify(token, secret) as { userId: number };
  }
}

export default new AuthService();
