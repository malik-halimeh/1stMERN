import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken, hashString } from '../utils/tokens.js';
import { AppError } from '../utils/errors.js';
import {
  RegisterValidator,
  LoginValidator,
  ForgotPasswordValidator,
  ResetPasswordValidator,
} from '../validators/auth.js';

// Helper cookie settings matching the security specification
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
});

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

    // Check if email already in use
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('AUTH_EMAIL_IN_USE', 'This email address is already registered.', 409);
    }

    // Hash password with bcrypt cost factor 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user. Role defaults to 'customer'
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'customer',
      isActive: true,
    });

    // Issue tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken();

    // Hash and store opaque refresh token in DB
    user.refreshTokenHash = hashString(refreshToken);
    await user.save();

    // Set HTTP-Only refresh cookie (format: userId:opaqueRefreshToken)
    res.cookie('refreshToken', `${user._id}:${refreshToken}`, getCookieOptions());

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
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

    // Issue new tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken();

    // Hash and save refresh token
    user.refreshTokenHash = hashString(refreshToken);
    await user.save();

    // Set cookie
    res.cookie('refreshToken', `${user._id}:${refreshToken}`, getCookieOptions());

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

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

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('AUTH_USER_NOT_FOUND', 'Associated session user not found.', 401);
    }

    const incomingHash = hashString(tokenPart);

    // Compromise detection: check if stored hash matches incoming hash
    if (user.refreshTokenHash !== incomingHash) {
      // Stale or duplicate reuse detected. Revoke all refresh access to force full re-login
      user.refreshTokenHash = null;
      await user.save();
      res.clearCookie('refreshToken', getCookieOptions());
      throw new AppError(
        'AUTH_SESSION_COMPROMISED',
        'Session compromised. Token reuse detected. Please log in again.',
        403
      );
    }

    // Happy Path: Rotate tokens
    const newAccessToken = generateAccessToken(user._id.toString(), user.role);
    const newRefreshToken = generateRefreshToken();

    user.refreshTokenHash = hashString(newRefreshToken);
    await user.save();

    res.cookie('refreshToken', `${user._id}:${newRefreshToken}`, getCookieOptions());

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    });
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
        const user = await User.findById(userId);
        if (user) {
          // Clear DB record hash
          user.refreshTokenHash = null;
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

    const user = await User.findOne({ email });
    if (!user) {
      // Secure behavior to prevent email enumeration: return success regardless
      res.status(200).json({
        success: true,
        data: {
          message: 'If the email is registered, a password reset link has been logged.',
        },
      });
      return;
    }

    // Generate short-lived reset token (JWT, 15min TTL)
    const resetToken = jwt.sign(
      { userId: user._id.toString(), type: 'reset' },
      process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_key_987654',
      { expiresIn: '15m' }
    );

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;

    // Stub service: Log reset details directly to console as specified
    console.log('\n================== STUB EMAIL SERVICE ==================');
    console.log(`To: ${user.email}`);
    console.log('Subject: OptiCart Password Reset Request');
    console.log(`Reset Link (Valid for 15 minutes):\n${resetLink}`);
    console.log('========================================================\n');

    res.status(200).json({
      success: true,
      data: {
        message: 'If the email is registered, a password reset link has been logged.',
      },
    });
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


