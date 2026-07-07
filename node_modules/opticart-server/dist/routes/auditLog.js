import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
// Audit logs are read-only and restricted exclusively to Super Admins
router.get('/', authenticate, authorize('super_admin'), getAuditLogs);
export default router;
