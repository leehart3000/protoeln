// Who can do what, decided from a project's members. These rules don't depend on how users
// signed in or where records are stored, so they can be tested on their own.

export interface CurrentUser {
  id: string
  orcid: string
  name: string
  siteAdmin: boolean
}

export interface ProjectAccess {
  publicRead: boolean
  members: { userId: { toString(): string }; role: string }[]
}

export type ProjectRole = 'admin' | 'member' | 'viewer'

// The user's role in the project, if they are a member
export function roleIn(project: ProjectAccess, user: CurrentUser | null): ProjectRole | null {
  if (user === null) return null
  const member = project.members.find((m) => m.userId.toString() === user.id)
  return (member?.role as ProjectRole | undefined) ?? null
}

export function canRead(project: ProjectAccess, user: CurrentUser | null): boolean {
  return project.publicRead || user?.siteAdmin === true || roleIn(project, user) !== null
}

// Creating notebooks and entries, commenting and reviewing (not for viewers)
export function canContribute(project: ProjectAccess, user: CurrentUser | null): boolean {
  if (user?.siteAdmin) return true
  const role = roleIn(project, user)
  return role === 'admin' || role === 'member'
}
