import { Router } from 'express'
import { deleteComment } from '../controllers/comment.controller.js'
import { reportComment } from '../controllers/report.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { reportLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post('/:id/report', reportLimiter, reportComment)
router.delete('/:id', requireAuth, deleteComment)

export default router
