# API

The API is served under `/api` and speaks JSON. It is built by `createApp` in
`backend/src/app.ts`, which doesn't start a server itself, so the same app runs under Node.js,
on Cloudflare Workers and in tests.

## Who is asking

`createApp` takes an `authenticate` function that works out who made each request, or `null`
for an anonymous request. Sign-in with ORCID will provide it; tests provide their own.

## Access

| Who | Can read a project | Can contribute (notebooks, entries, comments, reviews) |
| --- | --- | --- |
| Anyone, if the project is public | Yes | No |
| Project viewer | Yes | No |
| Project member or admin | Yes | Yes |
| Site admin | Yes | Yes |

Editing an entry is further limited to its author and co-authors, and signed entries are locked.

Someone who can't read a project is told it was **not found**, rather than forbidden, so private
projects don't reveal that they exist.

## Reading

| Request | Returns |
| --- | --- |
| `GET /api/health` | `{ "status": "ok" }` |
| `GET /api/me` | `{ "user": … }`, or `{ "user": null }` if no one is signed in |
| `GET /api/projects` | The projects the requester can read, by code |
| `GET /api/projects/:code` | `{ project, notebooks }` |
| `GET /api/notebooks/:id` | `{ notebook, project, entries }`; entries are summaries (no content), most recently changed first |
| `GET /api/entries/:code` | `{ entry, notebook, project }` |

## Errors

Errors are JSON: `{ "error": "…" }`, plus `"problems"` (each with a `path` and `message`) when
submitted content is invalid.

| Status | Meaning |
| --- | --- |
| 400 | The request body is not valid JSON |
| 403 | Not allowed |
| 404 | Not found (including records the requester can't read) |
| 409 | Conflicts with the record's current state (e.g. saved by someone else meanwhile, or signed) |
| 422 | Invalid, e.g. content not in the content format |
| 500 | Something went wrong on the server (details are logged, not sent) |
