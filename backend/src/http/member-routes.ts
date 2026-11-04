import { Router } from 'express'

import { canManageMembers } from '../access.ts'
import { membersOf, removeRole, setRole } from '../data/members.ts'
import { PROJECT_ROLES } from '../data/models/project.ts'
import { isValidOrcid } from '../data/orcid.ts'
import { findProjectByCode } from '../data/queries.ts'
import { ForbiddenError, InvalidError } from '../errors.ts'
import type { CurrentUser } from '../access.ts'
import { BodyReader, checkCanRead, requireUser } from './context.ts'
import { memberView } from './views.ts'

// A project's members: who has which role. Only its admins and site admins can see or change
// them; giving or taking away the admin role is for site admins only. Each change answers with
// the members as they now are.

export function memberRoutes(options: { orcidBaseUrl?: string } = {}) {
  const orcidBaseUrl = options.orcidBaseUrl ?? 'https://orcid.org'
  const router = Router()

  async function managedProject(code: string, user: CurrentUser) {
    const project = await findProjectByCode(code)
    checkCanRead(project, user)
    if (!canManageMembers(project, user)) {
      throw new ForbiddenError("Only the project's admins can see and change its members")
    }
    return project
  }

  async function members(projectId: Parameters<typeof membersOf>[0]) {
    return (await membersOf(projectId)).map((member) => memberView(member, orcidBaseUrl))
  }

  function checkOrcid(orcid: string) {
    if (!isValidOrcid(orcid)) {
      throw new InvalidError('The request has problems', [
        { path: 'orcid', message: 'should be an ORCID iD, such as 0000-0002-1825-0097' },
      ])
    }
  }

  router.get('/projects/:code/members', async (req, res) => {
    const project = await managedProject(req.params.code, requireUser(res))
    res.json(await members(project._id))
  })

  router.put('/projects/:code/members/:orcid', async (req, res) => {
    const user = requireUser(res)
    const project = await managedProject(req.params.code, user)
    checkOrcid(req.params.orcid)
    const body = new BodyReader(req.body)
    const role = body.oneOf('role', PROJECT_ROLES)
    body.done()

    await setRole({
      projectId: project._id,
      orcid: req.params.orcid,
      role,
      canManageAdmins: user.siteAdmin,
    })
    res.json(await members(project._id))
  })

  router.delete('/projects/:code/members/:orcid', async (req, res) => {
    const user = requireUser(res)
    const project = await managedProject(req.params.code, user)
    checkOrcid(req.params.orcid)

    await removeRole({
      projectId: project._id,
      orcid: req.params.orcid,
      canManageAdmins: user.siteAdmin,
    })
    res.json(await members(project._id))
  })

  return router
}
