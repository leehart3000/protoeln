import type mongoose from 'mongoose'

import { hashToken, randomToken } from '../auth/tokens.ts'
import { SessionModel, SIGN_IN_MINUTES, SignInAttemptModel } from './models/session.ts'
import { UserModel } from './models/user.ts'

export async function startSignIn(state: string, nonce: string, returnTo: string) {
  await SignInAttemptModel.create({ stateHash: hashToken(state), nonce, returnTo })
}

// Finishes a sign-in at most once: the attempt is deleted as it is read. Null if there is no
// such attempt, or it is too old.
export async function finishSignIn(state: string) {
  const cutoff = new Date(Date.now() - SIGN_IN_MINUTES * 60 * 1000)
  const attempt = await SignInAttemptModel.findOneAndDelete({
    stateHash: hashToken(state),
    createdAt: { $gt: cutoff },
  }).lean()
  return attempt === null ? null : { nonce: attempt.nonce, returnTo: attempt.returnTo }
}

// Finds the person by their ORCID iD, or adds them. Their name is updated if ORCID shared one;
// someone new who keeps their name private is named by their ORCID iD.
export async function rememberUser(orcid: string, name: string | null) {
  const lastSignedInAt = new Date()
  const update =
    name === null
      ? { $setOnInsert: { name: orcid }, $set: { lastSignedInAt } }
      : { $set: { name, lastSignedInAt } }
  return UserModel.findOneAndUpdate({ orcid }, update, {
    upsert: true,
    returnDocument: 'after',
    runValidators: true,
    setDefaultsOnInsert: true,
  })
    .orFail()
    .lean()
}

// Starts a session, returning the token for its cookie (only its hash is stored)
export async function startSession(userId: mongoose.Types.ObjectId, days: number) {
  const token = randomToken()
  await SessionModel.create({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  })
  return token
}

export async function userForSession(token: string) {
  const session = await SessionModel.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).lean()
  return session === null ? null : UserModel.findById(session.userId).lean()
}

export async function endSession(token: string) {
  await SessionModel.deleteOne({ tokenHash: hashToken(token) })
}
