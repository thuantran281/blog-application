import type { Request, Response } from 'express'
import { HttpError } from '../middleware/error.js'
import { storeImage } from '../services/upload.service.js'

export async function uploadImage(req: Request, res: Response) {
  const file = req.file

  if (!file) {
    throw new HttpError(400, 'An image file is required')
  }

  const image = await storeImage(file.buffer, file.mimetype)

  res.status(201).json({ data: image })
}
