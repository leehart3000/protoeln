// Errors that explain why a request can't be done. The API turns each into a matching HTTP status.

// No one is signed in, and the request needs someone to be
export class UnauthorizedError extends Error {
  readonly status = 401
}

export class NotFoundError extends Error {
  readonly status = 404
}

export class ForbiddenError extends Error {
  readonly status = 403
}

// The request conflicts with the record's current state, e.g. it was saved by someone else
// in the meantime, or it is locked because it has been signed
export class ConflictError extends Error {
  readonly status = 409
}

export class InvalidError extends Error {
  readonly status = 422
  readonly problems: { path: string; message: string }[]

  constructor(message: string, problems: { path: string; message: string }[] = []) {
    super(message)
    this.problems = problems
  }
}
