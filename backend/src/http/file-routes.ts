import { Router } from 'express'

import { canRead } from '../access.ts'
import { findFile, projectsShowing } from '../data/files.ts'
import { isImage } from '../data/models/file.ts'
import { NotFoundError } from '../errors.ts'
import { fileKey, type FileStore } from '../files/store.ts'
import { sitePublicRead, userOf } from './context.ts'

// Serves the files entries show, such as images, to whoever can read an entry (a draft or a
// version) that shows them; to anyone else, and on a site with no file store, a file is "not
// found", as a private project is. Files are found by their SHA-256 and never change. Images
// are shown in pages; anything else (a spreadsheet) is only ever downloaded, with its name.

// How a download is named: plainly for older browsers, and exactly (RFC 6266)
function downloadAs(name: string) {
  const plain = name.replace(/[^\x20-\x7e]|["\\]/g, '_') || 'file'
  return `attachment; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

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
      // As recorded when it was added: an image type browsers show safely, or a spreadsheet
      'Content-Type': file.contentType,
      'Content-Disposition': isImage(file.contentType) ? 'inline' : downloadAs(file.name),
      // A file never changes, but who can see it can, so only the browser keeps a copy
      'Cache-Control': 'private, max-age=3600',
      ETag: `"${file.sha256}"`,
      'Cross-Origin-Resource-Policy': 'same-origin',
    })
    res.send(Buffer.from(stored.body))
  })

  return router
}
