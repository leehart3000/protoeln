import mongoose from 'mongoose'

// A signed-in browser. Only a hash of the session cookie's token is stored. MongoDB deletes
// expired sessions by itself (a TTL index), and the API also refuses them until it does.
const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'sessions', timestamps: { createdAt: true, updatedAt: false } },
)
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const SessionModel = mongoose.model('Session', sessionSchema)

// A sign-in that has gone to ORCID and not yet come back. Each can be finished once, within
// ten minutes.
export const SIGN_IN_MINUTES = 10

const signInAttemptSchema = new mongoose.Schema(
  {
    stateHash: { type: String, required: true, unique: true },
    nonce: { type: String, required: true },
    // The page on this site to go back to afterwards
    returnTo: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { collection: 'sign_in_attempts' },
)
signInAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: SIGN_IN_MINUTES * 60 })

export const SignInAttemptModel = mongoose.model('SignInAttempt', signInAttemptSchema)
