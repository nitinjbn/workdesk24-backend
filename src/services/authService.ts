import { User } from '../models';
import { generateToken } from '../utils/jwt';

interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

export async function register({ email, password, name }: RegisterInput): Promise<AuthResponse> {
  const user = await User.create({ email, password, name });
  const token = generateToken({ userId: user.id, email: user.email });
  return { user, token };
}

export async function login({ email, password }: LoginInput): Promise<AuthResponse> {
  const user = await User.findOne({ where: { email } });

  if (!user) {
    const error: any = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  const valid = await user.comparePassword(password);

  if (!valid) {
    const error: any = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  const token = generateToken({ userId: user.id, email: user.email });
  return { user, token };
}
