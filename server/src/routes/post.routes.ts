import { Router } from 'express'
import { createComment, listComments } from '../controllers/comment.controller.js'
import {
  createPost,
  deletePost,
  getPost,
  listMyPosts,
  listPosts,
  updatePost,
} from '../controllers/post.controller.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'
import { commentLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.get('/', listPosts)
router.get('/mine', requireAuth, listMyPosts)
router.get('/:slug/comments', listComments)
router.post('/:slug/comments', commentLimiter, optionalAuth, createComment)
router.get('/:slug', optionalAuth, getPost)
router.post('/', requireAuth, createPost)
router.patch('/:id', requireAuth, updatePost)
router.delete('/:id', requireAuth, deletePost)

export default router
