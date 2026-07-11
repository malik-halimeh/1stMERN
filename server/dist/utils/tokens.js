import jwt from 'jsonwebtoken';
import crypto from 'crypto';
// The secret is resolved LAZILY (first token operation), not at module load:
// ESM imports are hoisted above dotenv.config() in server.ts, so reading
// process.env here at import time would always miss the .env value and
// silently sign every token with a fallback. Same pattern as services/mailer.
let cachedAccessSecret = null;
const getAccessSecret = () => {
    if (cachedAccessSecret)
        return cachedAccessSecret;
    const secret = process.env.JWT_ACCESS_SECRET;
    if (secret && secret.trim()) {
        cachedAccessSecret = secret;
        return cachedAccessSecret;
    }
    // No secret configured: refuse to run in production — a public fallback
    // string would let anyone forge admin tokens against the deployment.
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_ACCESS_SECRET is not set. Refusing to sign tokens with an insecure fallback in production.');
    }
    console.warn('[tokens] JWT_ACCESS_SECRET not set — using an insecure DEVELOPMENT-ONLY fallback.');
    cachedAccessSecret = 'dev_only_insecure_access_secret_987654';
    return cachedAccessSecret;
};
// 1. Generate Access Token (JWT, 15min TTL)
export const generateAccessToken = (userId, role) => {
    const payload = { userId, role };
    return jwt.sign(payload, getAccessSecret(), { expiresIn: '15m' });
};
// 2. Verify Access Token
export const verifyAccessToken = (token) => {
    return jwt.verify(token, getAccessSecret());
};
// 3. Generate Opaque Refresh Token (opaque random string)
export const generateRefreshToken = () => {
    return crypto.randomBytes(40).toString('hex');
};
// 4. Hash Opaque String via SHA-256
export const hashString = (value) => {
    return crypto.createHash('sha256').update(value).digest('hex');
};
