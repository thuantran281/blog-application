import { createHash } from 'node:crypto'
import type { Request, Response } from 'express'
import { HttpError } from '../middleware/error.js'
import { commentIdParamSchema, listReportsQuerySchema } from '../schemas/comment.schema.js'
import { findCommentById } from '../services/comment.service.js'
import { createCommentReport, listReportedComments } from '../services/report.service.js'

function reporterKeyFor(req: Request): string {
  if (req.user) {
    return `user:${req.user.id}`
  }

  const fingerprint = createHash('sha256')
    .update(`${req.ip ?? 'unknown'}|${req.get('user-agent') ?? ''}`)
    .digest('hex')

  return `guest:${fingerprint}`
}

export async function reportComment(req: Request, res: Response) {
  const { id } = commentIdParamSchema.parse(req.params)
  const comment = await findCommentById(id)

  if (!comment) {
    throw new HttpError(404, 'Comment not found')
  }

  const result = await createCommentReport(id, reporterKeyFor(req))

  res.status(result.created ? 201 : 200).json({
    data: { comment_id: id, report_count: result.reportCount },
  })
}

export async function listReports(req: Request, res: Response) {
  const { page, limit } = listReportsQuerySchema.parse(req.query)
  res.json(await listReportedComments({ page, limit }))
}
