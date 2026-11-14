import { Router } from 'express'
import { csrf, login, logout, me, register } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.get('/csrf', csrf)
router.get('/me', requireAuth, me)
router.post('/logout', logout)

export default router
