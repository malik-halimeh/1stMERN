import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import {
    CreateUserValidator,
    UpdateUserValidator,
    UpdateUserRoleValidator,
    UpdateUserStatusValidator,
} from '../validators/user.js';

const SAFE_FIELDS =
    '-passwordHash -refreshTokenHash -prevRefreshTokenHash -prevRefreshTokenExpiresAt';

// All handlers route failures through next(err) → the global errorHandler,
// like every other controller. Never respond with the raw error object:
// driver/Mongoose errors can leak query internals to the client.

const writeUserAudit = async (
    req: Request,
    actionType: 'role_change' | 'account_status_change' | 'user_delete',
    targetId: mongoose.Types.ObjectId,
    before: Record<string, unknown>,
    after: Record<string, unknown>
) => {
    try {
        const actor = await User.findById(req.user!.userId);
        await AuditLog.create({
            actorId: new mongoose.Types.ObjectId(req.user!.userId),
            actorName: actor?.name || 'Super Admin',
            actionType,
            targetEntityType: 'User',
            targetEntityId: targetId,
            changeDelta: { before, after },
        });
    } catch (auditErr: any) {
        console.error(`Failed to write audit log for ${actionType}:`, auditErr.message);
    }
};

/**
 * GET /api/users
 * Get all users
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        // Search by name or email (partial, case-insensitive)
        const q = req.query.q as string | undefined;
        const filter: Record<string, unknown> = {};
        if (q?.trim()) {
            const regex = { $regex: escapeRegex(q), $options: 'i' };
            filter.$or = [{ name: regex }, { email: regex }];
        }

        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select(SAFE_FIELDS)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            count: users.length,
            data: users,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/users/:id
 * Get a single user
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid user ID format.', 422);
        }

        const user = await User.findById(req.params.id).select(SAFE_FIELDS);
        if (!user) {
            throw new AppError('USER_NOT_FOUND', 'User not found.', 404);
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/users
 * Create a new user
 */
export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const validationResult = CreateUserValidator.safeParse(req.body);
        if (!validationResult.success) {
            const details = validationResult.error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            throw new AppError('VALIDATION_FAILED', 'Input validation failed.', 400, details);
        }

        const { name, email, password, role, addresses, isActive } = validationResult.data;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new AppError('USER_EMAIL_IN_USE', 'Email already exists.', 409);
        }

        // Hash password with bcrypt cost factor 12 (same as register)
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await User.create({
            name,
            email,
            passwordHash,
            role,
            addresses,
            isActive,
        });

        const userResponse: Partial<IUser> = user.toObject();
        delete userResponse.passwordHash;
        delete userResponse.refreshTokenHash;
        delete userResponse.prevRefreshTokenHash;
        delete userResponse.prevRefreshTokenExpiresAt;

        res.status(201).json({
            success: true,
            message: 'User created successfully.',
            data: userResponse,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/users/:id
 * Update a user
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid user ID format.', 422);
        }

        const validationResult = UpdateUserValidator.safeParse(req.body);
        if (!validationResult.success) {
            const details = validationResult.error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            throw new AppError('VALIDATION_FAILED', 'Input validation failed.', 400, details);
        }

        const { password, ...fields } = validationResult.data;
        const update: Record<string, unknown> = { ...fields };

        if (password) {
            const salt = await bcrypt.genSalt(12);
            update.passwordHash = await bcrypt.hash(password, salt);
        }

        const user = await User.findByIdAndUpdate(req.params.id, update, {
            new: true,
            runValidators: true,
        }).select(SAFE_FIELDS);

        if (!user) {
            throw new AppError('USER_NOT_FOUND', 'User not found.', 404);
        }

        res.status(200).json({
            success: true,
            message: 'User updated successfully.',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/users/:id
 * Delete a user
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid user ID format.', 422);
        }

        if (req.user?.userId === req.params.id) {
            throw new AppError('USER_SELF_DELETE', 'You cannot delete your own account.', 409);
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            throw new AppError('USER_NOT_FOUND', 'User not found.', 404);
        }

        await writeUserAudit(
            req,
            'user_delete',
            user._id as mongoose.Types.ObjectId,
            { name: user.name, email: user.email, role: user.role },
            {}
        );

        res.status(200).json({
            success: true,
            message: 'User deleted successfully.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/users/:id/role
 * Change a user's role (audited)
 */
export const updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const validationResult = UpdateUserRoleValidator.safeParse(req.body);
        if (!validationResult.success) {
            throw new AppError(
                'VALIDATION_FAILED',
                'Role must be one of: customer, inventory_manager, super_admin.',
                400
            );
        }

        if (req.user?.userId === req.params.id) {
            throw new AppError('USER_SELF_ROLE_CHANGE', 'You cannot change your own role.', 409);
        }

        const user = await User.findById(req.params.id).select(SAFE_FIELDS);
        if (!user) {
            throw new AppError('USER_NOT_FOUND', 'User not found.', 404);
        }

        const prevRole = user.role;
        if (prevRole === validationResult.data.role) {
            res.status(200).json({ success: true, message: 'Role unchanged.', data: user });
            return;
        }

        user.role = validationResult.data.role;
        await user.save();

        await writeUserAudit(
            req,
            'role_change',
            user._id as mongoose.Types.ObjectId,
            { role: prevRole },
            { role: user.role }
        );

        res.status(200).json({
            success: true,
            message: 'User role updated.',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/users/:id/status
 * Activate or deactivate an account (audited)
 */
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const validationResult = UpdateUserStatusValidator.safeParse(req.body);
        if (!validationResult.success) {
            throw new AppError('VALIDATION_FAILED', 'isActive must be a boolean.', 400);
        }

        if (req.user?.userId === req.params.id) {
            throw new AppError('USER_SELF_DEACTIVATE', 'You cannot deactivate your own account.', 409);
        }

        const user = await User.findById(req.params.id).select(SAFE_FIELDS);
        if (!user) {
            throw new AppError('USER_NOT_FOUND', 'User not found.', 404);
        }

        const prevStatus = user.isActive;
        if (prevStatus === validationResult.data.isActive) {
            res.status(200).json({ success: true, message: 'Status unchanged.', data: user });
            return;
        }

        user.isActive = validationResult.data.isActive;
        await user.save();

        await writeUserAudit(
            req,
            'account_status_change',
            user._id as mongoose.Types.ObjectId,
            { isActive: prevStatus },
            { isActive: user.isActive }
        );

        res.status(200).json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'}.`,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};
