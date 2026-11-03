import type { ErrorRequestHandler, RequestHandler } from 'express'

// Turns errors into JSON responses with the right HTTP status. Errors that explain themselves
// (those with a status, see errors.ts) are passed on as they are; anything else is an internal
// error, whose details are logged but not sent, so nothing about the server leaks out.

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' })
}

export const handleErrors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }
  // A request body that isn't valid JSON
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: 'The request body is not valid JSON' })
    return
  }
  if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
    const body: Record<string, unknown> = { error: error.message }
    if ('problems' in error) body.problems = error.problems
    res.status(error.status).json(body)
    return
  }
  console.error(error)
  res.status(500).json({ error: 'Something went wrong' })
}
