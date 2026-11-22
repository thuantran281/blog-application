import type { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import multer from 'multer'
import { env } from '../config/env.js'
import { uploadImage } from '../controllers/upload.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { uploadLimiter } from '../middleware/rateLimit.js'

const router = Router()
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
})

function parseImage(req: Request, res: Response, next: NextFunction) {
  parser.single('image')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new HttpError(413, 'Image is too large'))
      } else {
        next(new HttpError(400, 'Invalid image upload'))
      }
      return
    }

    next(err)
  })
}

router.post('/', uploadLimiter, requireAuth, parseImage, uploadImage)

export default router
