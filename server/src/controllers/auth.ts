import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User.js';
import { generateAccessToken, generateRefreshToken, hashString } from '../utils/tokens.js';
import { AppError } from '../utils/errors.js';
import { sendVerificationCodeEmail, sendPasswordResetCodeEmail } from '../services/mailer.js';
import {
  RegisterValidator,
  LoginValidator,
  ForgotPasswordValidator,
  ResetPasswordValidator,
} from '../validators/auth.js';

// Helper cookie settings matching the security specification.
// In production the client (static site) and API run on different onrender.com
// subdomains — the browser treats that as cross-site, so the refresh cookie must
// be SameSite=None; Secure or it will not be sent. Locally we keep Strict.
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd, // required by SameSite=None; Render serves over HTTPS
    sameSite: (isProd ? 'none' : 'strict') as 'none' | 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
};

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Generate a 6-digit code, store its hash on the user, and email it
const issueVerificationCode = async (user: IUser) => {
  const code = crypto.randomInt(100000, 1000000).toString();
  user.emailVerificationCodeHash = hashString(code);
  user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
  await user.save();
  await sendVerificationCodeEmail(user.email, code);
};

// Issue session tokens + refresh cookie and send the standard auth payload
const respondWithSession = async (res: Response, user: IUser, statusCode = 200) => {
  const accessToken = generateAccessToken(user._id.toString(), user.role);
  const refreshToken = generateRefreshToken();

  user.refreshTokenHash = hashString(refreshToken);
  user.prevRefreshTokenHash = null;
  user.prevRefreshTokenExpiresAt = null;
  await user.save();

  res.cookie('refreshToken', `${user._id}:${refreshToken}`, getCookieOptions());

  res.status(statusCode).json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        addresses: user.addresses,
      },
    },
  });
};

// 1. POST /api/auth/register
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request inputs using Zod
    const validationResult = RegisterValidator.safeParse(req.body);
    if (!validationResult.success) {
      const details = validationResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('AUTH_VALIDATION_FAILED', 'Input validation failed.', 400, details);
    }

    const { name, email, password } = validationResult.data;

    // Hash password with bcrypt cost factor 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Check if email already in use
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // A previous signup that never verified its email can retry: refresh
      // the pending account details and send a new code.
      if (existingUser.isEmailVerified === false) {
        existingUser.name = name;
        existingUser.passwordHash = passwordHash;
        await issueVerificationCode(existingUser);
        res.status(200).json({
          success: true,
          data: {
            requiresVerification: true,
            email: existingUser.email,
            message: 'A new verification code has been sent to your email.',
          },
        });
        return;
      }
      throw new AppError('AUTH_EMAIL_IN_USE', 'This email address is already registered.', 409);
    }

    // Create user unverified. Role defaults to 'customer'; no session tokens
    // are issued until the emailed code is confirmed.
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'customer',
      isActive: true,
      isEmailVerified: false,
      authProvider: 'local',
    });

    await issueVerificationCode(user);

    res.status(201).json({
      success: true,
      data: {
        requiresVerification: true,
        email: user.email,
        message: 'A verification code has been sent to your email.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 1b. POST /api/auth/verify-email — confirm the signup code and open the session
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;
    if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
      throw new AppError('AUTH_VALIDATION_FAILED', 'Email and verification code are required.', 400);
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      throw new AppError('AUTH_INVALID_CODE', 'Invalid verification code.', 401);
    }

    if (user.isEmailVerified !== false) {
      // Already verified — just tell the client to log in normally
      throw new AppError('AUTH_ALREADY_VERIFIED', 'This account is already verified. Please sign in.', 409);
    }

    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError('AUTH_CODE_EXPIRED', 'The verification code has expired. Please request a new one.', 401);
    }

    if (hashString(code.trim()) !== user.emailVerificationCodeHash) {
      throw new AppError('AUTH_INVALID_CODE', 'Invalid verification code.', 401);
    }

    user.isEmailVerified = true;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;

    await respondWithSession(res, user, 200);
  } catch (error) {
    next(error);
  }
};

// 1c. POST /api/auth/resend-verification — issue a fresh code (no enumeration)
export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      throw new AppError('AUTH_VALIDATION_FAILED', 'Email is required.', 400);
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user && user.isEmailVerified === false) {
      await issueVerificationCode(user);
    }

    // Same response whether or not the account exists
    res.status(200).json({
      success: true,
      data: { message: 'If a pending account exists for this email, a new code has been sent.' },
    });
  } catch (error) {
    next(error);
  }
};

// 1d. POST /api/auth/google — sign in / sign up with a Google ID token.
// The Google account's email is verified by Google, so no code flow is needed.
export const googleAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      throw new AppError('AUTH_VALIDATION_FAILED', 'Google credential is required.', 400);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new AppError('AUTH_GOOGLE_DISABLED', 'Google sign-in is not configured on this server.', 501);
    }

    // Validate the ID token against Google's tokeninfo endpoint
    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!infoRes.ok) {
      throw new AppError('AUTH_GOOGLE_INVALID', 'Google sign-in token is invalid or expired.', 401);
    }
    const info: any = await infoRes.json();

    if (info.aud !== clientId) {
      throw new AppError('AUTH_GOOGLE_INVALID', 'Google token was issued for a different application.', 401);
    }
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      throw new AppError('AUTH_GOOGLE_UNVERIFIED', 'This Google account has no verified email.', 403);
    }

    const email = String(info.email).toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      // First Google sign-in: provision a customer account with an unusable
      // random password (they authenticate via Google).
      const randomPw = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(12);
      user = await User.create({
        name: info.name || email.split('@')[0],
        email,
        passwordHash: await bcrypt.hash(randomPw, salt),
        role: 'customer',
        isActive: true,
        isEmailVerified: true,
        authProvider: 'google',
      });
    } else {
      if (!user.isActive) {
        throw new AppError('AUTH_ACCOUNT_DISABLED', 'Your account has been deactivated. Please contact support.', 403);
      }
      // Google verified ownership of this email — clear any pending code flow
      if (user.isEmailVerified === false) {
        user.isEmailVerified = true;
        user.emailVerificationCodeHash = null;
        user.emailVerificationExpiresAt = null;
      }
    }

    await respondWithSession(res, user, 200);
  } catch (error) {
    next(error);
  }
};

// 2. POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = LoginValidator.safeParse(req.body);
    if (!validationResult.success) {
      const details = validationResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('AUTH_VALIDATION_FAILED', 'Input validation failed.', 400, details);
    }

    const { email, password } = validationResult.data;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    // Verify hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    // Reject deactivated accounts
    if (!user.isActive) {
      throw new AppError('AUTH_ACCOUNT_DISABLED', 'Your account has been deactivated. Please contact support.', 403);
    }

    // Unverified signups must confirm their email first — send a fresh code
    // so the client can jump straight to the verification step.
    if (user.isEmailVerified === false) {
      await issueVerificationCode(user);
      throw new AppError(
        'AUTH_EMAIL_NOT_VERIFIED',
        'Please verify your email address. A new verification code has been sent.',
        403
      );
    }

    await respondWithSession(res, user, 200);
  } catch (error) {
    next(error);
  }
};

// Rotation grace window: after a rotation, the replaced refresh token is still
// accepted (for a new ACCESS token only, no re-rotation) for this long, so
// near-simultaneous refreshes from multiple tabs don't trip reuse detection.
const ROTATION_GRACE_MS = 30 * 1000;

// 3. POST /api/auth/refresh
export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshCookie = req.cookies.refreshToken;
    if (!refreshCookie) {
      throw new AppError('AUTH_MISSING_REFRESH_TOKEN', 'Session refresh token is missing.', 401);
    }

    const separatorIndex = refreshCookie.indexOf(':');
    if (separatorIndex === -1) {
      throw new AppError('AUTH_INVALID_REFRESH_TOKEN', 'Session refresh token is malformed.', 401);
    }

    const userId = refreshCookie.substring(0, separatorIndex);
    const tokenPart = refreshCookie.substring(separatorIndex + 1);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('AUTH_INVALID_REFRESH_TOKEN', 'Session refresh token is malformed.', 401);
    }

    const incomingHash = hashString(tokenPart);

    const newRefreshToken = generateRefreshToken();

    // Happy path — atomic rotation: the hash match is part of the query, so
    // of N concurrent refreshes carrying the same token exactly one rotates.
    const rotated = await User.findOneAndUpdate(
      { _id: userId, refreshTokenHash: incomingHash },
      {
        refreshTokenHash: hashString(newRefreshToken),
        prevRefreshTokenHash: incomingHash,
        prevRefreshTokenExpiresAt: new Date(Date.now() + ROTATION_GRACE_MS),
      },
      { new: true }
    );

    if (rotated) {
      res.cookie('refreshToken', `${rotated._id}:${newRefreshToken}`, getCookieOptions());
      res.status(200).json({
        success: true,
        data: {
          accessToken: generateAccessToken(rotated._id.toString(), rotated.role),
        },
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('AUTH_USER_NOT_FOUND', 'Associated session user not found.', 401);
    }

    // Grace path: this token was just rotated away by a concurrent request
    // (another tab). Issue a fresh access token but do NOT rotate again — the
    // shared cookie jar already holds the newest refresh token.
    if (
      user.prevRefreshTokenHash === incomingHash &&
      user.prevRefreshTokenExpiresAt &&
      user.prevRefreshTokenExpiresAt.getTime() > Date.now()
    ) {
      res.status(200).json({
        success: true,
        data: {
          accessToken: generateAccessToken(user._id.toString(), user.role),
        },
      });
      return;
    }

    // Stale or duplicate reuse outside the grace window. Revoke all refresh
    // access to force full re-login
    user.refreshTokenHash = null;
    user.prevRefreshTokenHash = null;
    user.prevRefreshTokenExpiresAt = null;
    await user.save();
    res.clearCookie('refreshToken', getCookieOptions());
    throw new AppError(
      'AUTH_SESSION_COMPROMISED',
      'Session compromised. Token reuse detected. Please log in again.',
      403
    );
  } catch (error) {
    next(error);
  }
};

// 4. POST /api/auth/logout
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshCookie = req.cookies.refreshToken;

    if (refreshCookie) {
      const separatorIndex = refreshCookie.indexOf(':');
      if (separatorIndex !== -1) {
        const userId = refreshCookie.substring(0, separatorIndex);
        const user = mongoose.Types.ObjectId.isValid(userId)
          ? await User.findById(userId)
          : null;
        if (user) {
          // Clear DB record hash
          user.refreshTokenHash = null;
          user.prevRefreshTokenHash = null;
          user.prevRefreshTokenExpiresAt = null;
          await user.save();
        }
      }
    }

    // Clear HTTP cookie
    res.clearCookie('refreshToken', getCookieOptions());

    res.status(200).json({
      success: true,
      data: {
        message: 'Successfully logged out session.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = ForgotPasswordValidator.safeParse(req.body);
    if (!validationResult.success) {
      const details = validationResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('AUTH_VALIDATION_FAILED', 'Input validation failed.', 400, details);
    }

    const { email } = validationResult.data;

    // Same-flow as signup: email a 6-digit code (hash stored, 15min TTL).
    // Secure behavior to prevent email enumeration: identical response
    // whether or not the account exists.
    const user = await User.findOne({ email });
    if (user && user.isActive) {
      const code = crypto.randomInt(100000, 1000000).toString();
      user.passwordResetCodeHash = hashString(code);
      user.passwordResetExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
      await user.save();
      await sendPasswordResetCodeEmail(user.email, code);
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'If the email is registered, a password reset code has been sent.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5b. POST /api/auth/reset-password — confirm the emailed code and set the new password
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = ResetPasswordValidator.safeParse(req.body);
    if (!validationResult.success) {
      const details = validationResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('AUTH_VALIDATION_FAILED', 'Input validation failed.', 400, details);
    }

    const { email, code, password } = validationResult.data;

    const user = await User.findOne({ email });
    if (!user || !user.passwordResetCodeHash) {
      throw new AppError('AUTH_INVALID_CODE', 'Invalid reset code.', 401);
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new AppError('AUTH_CODE_EXPIRED', 'The reset code has expired. Please request a new one.', 401);
    }

    if (hashString(code) !== user.passwordResetCodeHash) {
      throw new AppError('AUTH_INVALID_CODE', 'Invalid reset code.', 401);
    }

    if (!user.isActive) {
      throw new AppError('AUTH_ACCOUNT_DISABLED', 'Your account has been deactivated. Please contact support.', 403);
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.passwordResetCodeHash = null;
    user.passwordResetExpiresAt = null;

    // Completing the code flow also proves ownership of the email address
    if (user.isEmailVerified === false) {
      user.isEmailVerified = true;
      user.emailVerificationCodeHash = null;
      user.emailVerificationExpiresAt = null;
    }

    // respondWithSession rotates the refresh token, which also revokes any
    // session an attacker might have had before the password change.
    await respondWithSession(res, user, 200);
  } catch (error) {
    next(error);
  }
};

// 6. PATCH /api/auth/profile - Customer Profile & Addresses Manager
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { name, addresses } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User profile not found.', 404);
    }

    if (name !== undefined) {
      user.name = name;
    }

    if (addresses !== undefined) {
      if (!Array.isArray(addresses)) {
        throw new AppError('VALIDATION_FAILED', 'Addresses parameter must be an array.', 422);
      }

      let hasDefault = false;
      const parsedAddresses = addresses.map((addr: any) => {
        const isDef = !!addr.isDefault;
        let isDefaultAddress = false;
        if (isDef) {
          if (!hasDefault) {
            hasDefault = true;
            isDefaultAddress = true;
          }
        }
        return {
          label: addr.label || 'Home',
          line1: addr.line1 || '',
          line2: addr.line2 || '',
          city: addr.city || '',
          country: addr.country || '',
          isDefault: isDefaultAddress,
        };
      });

      if (parsedAddresses.length > 0 && !hasDefault) {
        parsedAddresses[0].isDefault = true;
      }

      user.addresses = parsedAddresses as any;
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        addresses: user.addresses,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 7. GET /api/auth/profile - Fetch Current User Profile Details
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User profile not found.', 404);
    }
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        addresses: user.addresses,
      },
    });
  } catch (error) {
    next(error);
  }
};


