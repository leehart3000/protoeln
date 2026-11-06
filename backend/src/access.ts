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

export type ProjectRole = 'admin' | 'contributor' | 'viewer'

// The user's role in the project, if they are a member
export function roleIn(project: ProjectAccess, user: CurrentUser | null): ProjectRole | null {
  if (user === null) return null
  const member = project.members.find((m) => m.userId.toString() === user.id)
  return (member?.role as ProjectRole | undefined) ?? null
}

// Reading a project: anyone, if it's public and the site lets anyone read public projects
// (sitePublicRead, from PROTOELN_PUBLIC_READ); otherwise its members and site admins
export function canRead(
  project: ProjectAccess,
  user: CurrentUser | null,
  sitePublicRead: boolean,
): boolean {
  return (
    (sitePublicRead && project.publicRead) ||
    user?.siteAdmin === true ||
    roleIn(project, user) !== null
  )
}

// Creating notebooks and entries, commenting and reviewing (not for viewers)
export function canContribute(project: ProjectAccess, user: CurrentUser | null): boolean {
  if (user?.siteAdmin) return true
  const role = roleIn(project, user)
  return role === 'admin' || role === 'contributor'
}

// Choosing a project's members and their roles: its admins, and site admins. Giving or taking
// away the admin role itself is for site admins only (as in ProtoLIMS).
export function canManageMembers(project: ProjectAccess, user: CurrentUser | null): boolean {
  return user?.siteAdmin === true || roleIn(project, user) === 'admin'
}

// Changing a project's details (its title, description, and whether it's public): the same
// people as choose its members
export function canEditProject(project: ProjectAccess, user: CurrentUser | null): boolean {
  return canManageMembers(project, user)
}

// Changing a notebook's details (its title and description): its owner, while they can
// contribute to its project; the project's admins; and site admins
export function canEditNotebook(
  notebook: { ownerId: { toString(): string } },
  project: ProjectAccess,
  user: CurrentUser | null,
): boolean {
  if (user === null) return false
  if (canEditProject(project, user)) return true
  return notebook.ownerId.toString() === user.id && canContribute(project, user)
}

// Signed and witnessed entries are locked: corrections are made with an addendum
export function isLocked(status: string): boolean {
  return status === 'signed' || status === 'witnessed'
}

// Changing an entry: its author and co-authors, while they can contribute to its project and
// the entry isn't locked
export function canEditEntry(
  entry: {
    authorId: { toString(): string }
    coAuthorIds: { toString(): string }[]
    status: string
  },
  project: ProjectAccess,
  user: CurrentUser | null,
): boolean {
  if (user === null || !canContribute(project, user) || isLocked(entry.status)) {
    return false
  }
  return [entry.authorId, ...entry.coAuthorIds].some((id) => id.toString() === user.id)
}
