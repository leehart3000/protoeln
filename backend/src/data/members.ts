import type mongoose from 'mongoose'

import { ConflictError, ForbiddenError, NotFoundError } from '../errors.ts'
import { ProjectModel, type ProjectRole } from './models/project.ts'
import { UserModel } from './models/user.ts'

// A project's members and their roles: listing them, and giving, changing or taking away roles.
// People are found by ORCID iD, and can be added before they first sign in: they're named by
// their iD until they do, and their role is waiting for them.

type Id = mongoose.Types.ObjectId

const RANKS: Record<ProjectRole, number> = { admin: 0, contributor: 1, viewer: 2 }

const ADMINS_ONLY = "Only site admins can give or take away a project's admin role"

// Admins first, then contributors, then viewers, each by name
export async function membersOf(projectId: Id) {
  const project = await ProjectModel.findById(projectId).orFail().lean()
  const users = await UserModel.find({ _id: { $in: project.members.map((m) => m.userId) } })
    .select('name orcid lastSignedInAt')
    .lean()
  const byId = new Map(users.map((user) => [user._id.toHexString(), user]))
  return project.members
    .flatMap((member) => {
      const user = byId.get(member.userId.toHexString())
      return user
        ? [
            {
              name: user.name,
              orcid: user.orcid,
              signedIn: user.lastSignedInAt != null,
              role: member.role as ProjectRole,
            },
          ]
        : []
    })
    .sort((a, b) => RANKS[a.role] - RANKS[b.role] || a.name.localeCompare(b.name))
}

// Finds someone by ORCID iD, adding them if they're new (named by their iD until they sign in)
async function personWith(orcid: string) {
  return UserModel.findOneAndUpdate(
    { orcid },
    { $setOnInsert: { name: orcid } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
    .orFail()
    .lean()
}

function checkKeepsAnAdmin(members: { role: string }[]) {
  if (members.filter((member) => member.role === 'admin').length <= 1) {
    throw new ConflictError(
      "A project needs at least one admin, so its last admin can't be removed or given another role",
    )
  }
}

// Gives someone a role in the project, or changes it. Only site admins (`canManageAdmins`) can
// give the admin role or change an admin's role.
export async function setRole(input: {
  projectId: Id
  orcid: string
  role: ProjectRole
  canManageAdmins: boolean
}) {
  const person = await personWith(input.orcid)
  const project = await ProjectModel.findById(input.projectId).orFail()
  const member = project.members.find((m) => m.userId.equals(person._id))
  if (member?.role === input.role) {
    return
  }
  if ((input.role === 'admin' || member?.role === 'admin') && !input.canManageAdmins) {
    throw new ForbiddenError(ADMINS_ONLY)
  }
  if (member?.role === 'admin') {
    checkKeepsAnAdmin(project.members)
  }
  if (member) {
    member.role = input.role
  } else {
    project.members.push({ userId: person._id, role: input.role })
  }
  await project.save()
}

// Takes away someone's role in the project
export async function removeRole(input: {
  projectId: Id
  orcid: string
  canManageAdmins: boolean
}) {
  const person = await UserModel.findOne({ orcid: input.orcid }).lean()
  const project = await ProjectModel.findById(input.projectId).orFail()
  const member = person && project.members.find((m) => m.userId.equals(person._id))
  if (!member) {
    throw new NotFoundError(`${input.orcid} isn't a member of this project`)
  }
  if (member.role === 'admin') {
    if (!input.canManageAdmins) {
      throw new ForbiddenError(ADMINS_ONLY)
    }
    checkKeepsAnAdmin(project.members)
  }
  project.members.pull(member)
  await project.save()
}
