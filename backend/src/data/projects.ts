import { ConflictError } from '../errors.ts'
import { ProjectModel } from './models/project.ts'

// Creates a project, whose creator becomes its first admin. Codes are unique, so a code
// already in use is refused.
export async function createProject(input: {
  code: string
  title: string
  description?: string
  publicRead: boolean
  creatorId: string
}) {
  const taken = () => new ConflictError(`There is already a project with the code ${input.code}`)
  if ((await ProjectModel.exists({ code: input.code })) !== null) {
    throw taken()
  }
  try {
    const project = await ProjectModel.create({
      code: input.code,
      title: input.title,
      description: input.description,
      publicRead: input.publicRead,
      members: [{ userId: input.creatorId, role: 'admin' }],
    })
    return project.toObject()
  } catch (error) {
    // Someone else took the code at the same moment
    if (error instanceof Error && 'code' in error && error.code === 11000) {
      throw taken()
    }
    throw error
  }
}
