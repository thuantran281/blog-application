import { Router } from 'express'
import {
  listUsersHandler,
  resetPasswordHandler,
  updateRoleHandler,
} from '../controllers/admin.controller.js'
import { listReports } from '../controllers/report.controller.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

router.use(requireAdmin)

router.get('/reports', listReports)
router.get('/users', listUsersHandler)
router.patch('/users/:id/role', updateRoleHandler)
router.post('/users/:id/reset-password', resetPasswordHandler)

export default router
