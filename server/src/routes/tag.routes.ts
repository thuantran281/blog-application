import { Router } from 'express'
import { createTag, deleteTag, getTag, listTags, updateTag } from '../controllers/tag.controller.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', listTags)
router.get('/:slug', getTag)
router.post('/', requireAuth, requireAdmin, createTag)
router.patch('/:id', requireAuth, requireAdmin, updateTag)
router.delete('/:id', requireAuth, requireAdmin, deleteTag)

export default router
