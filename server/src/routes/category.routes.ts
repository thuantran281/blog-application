import { Router } from 'express'
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../controllers/category.controller.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', listCategories)
router.get('/:slug', getCategory)
router.post('/', requireAuth, requireAdmin, createCategory)
router.patch('/:id', requireAuth, requireAdmin, updateCategory)
router.delete('/:id', requireAuth, requireAdmin, deleteCategory)

export default router
