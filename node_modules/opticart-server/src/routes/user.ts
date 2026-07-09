import { Router } from 'express';
import {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    updateUserRole,
    updateUserStatus,
    deleteUser,
} from '../controllers/user.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// User management (accounts, roles) is restricted exclusively to Super Admins
router.use(authenticate, authorize('super_admin'));

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/role', updateUserRole);
router.patch('/:id/status', updateUserStatus);
router.delete('/:id', deleteUser);

export default router;