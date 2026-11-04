import mongoose, { type InferSchemaType } from 'mongoose'

import { isValidOrcid } from '../orcid.ts'

const userSchema = new mongoose.Schema(
  {
    // People sign in with ORCID, so their ORCID iD identifies them
    orcid: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: isValidOrcid,
        message: (props: { value: unknown }) => `${String(props.value)} is not a valid ORCID iD`,
      },
    },
    name: { type: String, required: true },
    siteAdmin: { type: Boolean, default: false },
    // When they last signed in: null for someone added to a project before signing in, whose
    // name is their ORCID iD until they do
    lastSignedInAt: { type: Date, default: null },
  },
  { collection: 'users', timestamps: true },
)

export type User = InferSchemaType<typeof userSchema>
export const UserModel = mongoose.model('User', userSchema)
