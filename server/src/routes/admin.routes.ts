import { Router } from 'express'
import { listReports } from '../controllers/report.controller.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

router.get('/reports', requireAdmin, listReports)

export default router
