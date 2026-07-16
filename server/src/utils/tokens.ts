import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// The secret is resolved LAZILY (first token operation), not at module load:
// ESM imports are hoisted above dotenv.config() in server.ts, so reading
// process.env here at import time would always miss the .env value and
// silently sign every token with a fallback. Same pattern as services/mailer.
let cachedAccessSecret: string | null = null;

const getAccessSecret = (): string => {
  if (cachedAccessSecret) return cachedAccessSecret;

  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret && secret.trim()) {
    cachedAccessSecret = secret;
    return cachedAccessSecret;
  }

  // No secret configured: refuse to run in production — a public fallback
  // string would let anyone forge admin tokens against the deployment.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_ACCESS_SECRET is not set. Refusing to sign tokens with an insecure fallback in production.'
    );
  }

  console.warn('[tokens] JWT_ACCESS_SECRET not set — using an insecure DEVELOPMENT-ONLY fallback.');
  cachedAccessSecret = 'dev_only_insecure_access_secret_987654';
  return cachedAccessSecret;
};

export interface IAccessTokenPayload {
  userId: string;
  role: string;
}

// 1. Generate Access Token (JWT). TTL defaults to 15min but can be overridden
// via JWT_ACCESS_TTL (e.g. '30s') — handy for demoing the silent-refresh cycle
// without a code change. Read at call time (not import) so it survives the same
// dotenv-hoisting issue documented for the secret above.
export const generateAccessToken = (userId: string, role: string): string => {
  const payload: IAccessTokenPayload = { userId, role };
  const ttl = (process.env.JWT_ACCESS_TTL?.trim() || '15m') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ttl });
};

// 2. Verify Access Token
export const verifyAccessToken = (token: string): IAccessTokenPayload => {
  return jwt.verify(token, getAccessSecret()) as IAccessTokenPayload;
};

// 3. Generate Opaque Refresh Token (opaque random string)
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

// 4. Hash Opaque String via SHA-256
export const hashString = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};
