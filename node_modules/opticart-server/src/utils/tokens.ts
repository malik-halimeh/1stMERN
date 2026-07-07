import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_key_987654';

export interface IAccessTokenPayload {
  userId: string;
  role: string;
}

// 1. Generate Access Token (JWT, 15min TTL)
export const generateAccessToken = (userId: string, role: string): string => {
  const payload: IAccessTokenPayload = { userId, role };
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
};

// 2. Verify Access Token
export const verifyAccessToken = (token: string): IAccessTokenPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as IAccessTokenPayload;
};

// 3. Generate Opaque Refresh Token (opaque random string)
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

// 4. Hash Opaque String via SHA-256
export const hashString = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};
