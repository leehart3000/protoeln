import { Router } from 'express'

import { canRead } from '../access.ts'
import { findFile, projectsShowing } from '../data/files.ts'
import { NotFoundError } from '../errors.ts'
import { fileKey, type FileStore } from '../files/store.ts'
import { sitePublicRead, userOf } from './context.ts'

// Serves the files entries show, such as images, to whoever can read an entry (a draft or a
// version) that shows them; to anyone else, and on a site with no file store, a file is "not
// found", as a private project is. Files are found by their SHA-256 and never change.

export function fileRoutes(store: FileStore | null) {
  const router = Router()

  router.get('/files/:sha256', async (req, res) => {
    const file = await findFile(req.params.sha256)
    if (file === null || store === null) throw new NotFoundError('File not found')
    const user = userOf(res)
    const publicRead = sitePublicRead(res)
    const projects = await projectsShowing(file.sha256)
    if (!projects.some((project) => canRead(project, user, publicRead))) {
      throw new NotFoundError('File not found')
    }
    const stored = await store.get(fileKey(file.sha256))
    if (stored === null) {
      console.error(`File ${file.sha256} is recorded, but isn't in the file store`)
      throw new NotFoundError('File not found')
    }

    res.set({
      // As recorded when it was added, which is one of the image types browsers show safely
      'Content-Type': file.contentType,
      'Content-Disposition': 'inline',
      // A file never changes, but who can see it can, so only the browser keeps a copy
      'Cache-Control': 'private, max-age=3600',
      ETag: `"${file.sha256}"`,
      'Cross-Origin-Resource-Policy': 'same-origin',
    })
    res.send(Buffer.from(stored.body))
  })

  return router
}
