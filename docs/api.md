# API

The API is served under `/api/v1` and speaks JSON. The version is part of every address (as in
ProtoLIMS), so a later, incompatible version can be served alongside this one. It is built by `createApp` in
`backend/src/app.ts`, which doesn't start a server itself, so the same app runs under Node.js,
on Cloudflare Workers and in tests.

## Who is asking

`createApp` takes an `authenticate` function that works out who made each request, or `null`
for an anonymous request. When running for real, it reads the session cookie that signing in
with ORCID sets; tests provide their own.

## Signing in and out

People sign in with ORCID (OpenID Connect), as in ProtoLIMS. The API does the whole sign-in
itself, so the browser never holds any tokens:

| Request | Does |
| --- | --- |
| `GET /api/v1/auth/orcid/login?returnTo=/page` | Sends the browser to ORCID, with a random state (also kept in a 10-minute cookie) and nonce. A browser on another host name for the site is first moved to the public address |
| `GET /api/v1/auth/orcid/callback` | Where ORCID sends the browser back. Checks the state, swaps the one-time code for an ID token, checks the token's signature against ORCID's published keys (and its issuer, audience, age and nonce), remembers the person by their ORCID iD, sets the session cookie, and goes back to `returnTo` (a page on this site only) |
| `POST /api/v1/auth/logout` | Ends the session (204) |

The session cookie (`protoeln_session`) is HttpOnly, so page scripts can't read it, and
SameSite=Lax, so other sites can't make changes with it; it is Secure when the site is served
over HTTPS. Only a hash of its token is stored. If the person cancels at ORCID, nobody is
signed in. Without an ORCID client ID and secret, sign-in answers 503.

## Access

| Who | Can read a project | Can contribute (notebooks, entries, comments, reviews) |
| --- | --- | --- |
| Anyone, if the project is public | Yes | No |
| Project viewer | Yes | No |
| Project contributor or admin | Yes | Yes |
| Site admin | Yes | Yes |

Editing an entry is further limited to its author and co-authors, and signed entries are locked.

Someone who can't read a project is told it was **not found**, rather than forbidden, so private
projects don't reveal that they exist.

## Reading

| Request | Returns |
| --- | --- |
| `GET /api/v1/health` | `{ "status": "ok" }` |
| `GET /api/v1/me` | `{ "user": { name, orcid, orcidUrl, siteAdmin, since, roles } }`, where `roles` lists the projects the person is a member of, each with their role; or `{ "user": null }` if no one is signed in |
| `GET /api/v1/projects` | The projects the requester can read, by code, each with `yourRole` (the requester's role in it, or `null`) and `canContribute` (whether they can add notebooks and entries) |
| `GET /api/v1/projects/:code` | `{ project, notebooks }` |
| `GET /api/v1/notebooks` | Every notebook the requester can read, across projects, most recently changed first, each with its `project` |
| `GET /api/v1/notebooks/:id` | `{ notebook, project, entries }`; entries are summaries (no content), most recently changed first |
| `GET /api/v1/entries` | Summaries (no content) of every entry the requester can read, across projects, most recently changed first, each with its `notebook` and `project` |
| `GET /api/v1/entries/:code` | `{ entry, notebook, project }`; `entry.canEdit` says whether the requester can change it (its author or a co-author, who can contribute to the project, while it isn't signed) |
| `GET /api/v1/entries/:code/versions` | Summaries of the entry's versions (no content), newest first |
| `GET /api/v1/entries/:code/versions/:number` | One version in full, with its plain-text and Markdown copies |
| `GET /api/v1/entries/:code/history-check` | `{ intact, problems }`: recalculates every version's hash to check none has been changed |

### What responses show

Records are never sent as stored. Each kind of record has a view (in
`backend/src/http/views.ts`) listing exactly the fields the API shows, so internal details, such
as the database ids of people and project members, stay inside. A field added to a model is only
shown once its view includes it.

- **People** (authors, notebook owners, who created a version) are shown by name and ORCID iD,
  both public: `{ "name": "Josiah Carberry", "orcid": "0000-0002-1825-0097" }`.
- **Projects** and **entries** are identified by their codes. **Notebooks**, which have no code,
  are identified by `id`.
- **Project members** aren't listed.
- An entry's `updatedAt` is what a save sends back as `basedOn`.
- A ticked protocol step records who ticked it by ORCID iD (`attrs.doneBy`). An entry's
  `contentPeople` gives their names, by ORCID iD.

## Writing

Each write needs someone signed in (otherwise 401). Creating a project needs a site admin;
everything else needs a contributor or admin of the project (otherwise 403).

| Request | Body | Does |
| --- | --- | --- |
| `POST /api/v1/projects` | `code` (2 to 10 capital letters and digits, starting with a letter), `title`, optional `description`, optional `publicRead` (default false) | Creates a project, with the requester as its admin (201); site admins only. A code already in use is refused (409) |
| `POST /api/v1/projects/:code/notebooks` | `title`, optional `description` | Creates a notebook owned by the requester (201) |
| `POST /api/v1/notebooks/:id/entries` | `kind` (`experiment`, `protocol` or `note`), `title`, optional `content` | Creates a draft entry by the requester (201) |
| `PUT /api/v1/entries/:code/draft` | `basedOn` (the `updatedAt` of the draft being edited), `title`, `content` | Saves the draft and records what changed; author and co-authors only |
| `PUT /api/v1/entries/:code/steps` | `basedOn`, `path` (where the step is in the draft, e.g. `[2, 0, 1]`), `done` (true or false) | Ticks or unticks a protocol step, and records what changed; the server sets who ticked it (`doneBy`) and when (`doneAt`); author and co-authors only |
| `POST /api/v1/entries/:code/versions` | optional `note` | Creates the next version (201); author and co-authors only |

A save or tick whose `basedOn` is out of date (someone else has saved since) is refused with
409, so work is never silently overwritten, and a step is never ticked in the wrong place.

Ticks are only made by `PUT …/steps`, so they can be trusted. Content saved as a draft, or given
when creating an entry, can keep the ticks the draft already has (when steps are moved, copied
or deleted), but can't add or change one (422).

## Members

A project's admins, and site admins, can see and choose its members. Giving or taking away the
admin role is for site admins only, and a project always keeps at least one admin.
People are found by ORCID iD, and can be added before they first sign in: they're named by their
iD until they do, and their role is waiting for them. Each change answers with the members as
they now are.

| Request | Body | Does |
| --- | --- | --- |
| `GET /api/v1/projects/:code/members` | | The members, admins first, each with `name`, `orcid`, `orcidUrl`, `signedIn` and `role` |
| `PUT /api/v1/projects/:code/members/:orcid` | `role` (`admin`, `contributor` or `viewer`) | Gives the person that role, or changes theirs |
| `DELETE /api/v1/projects/:code/members/:orcid` | | Takes away the person's role (404 if they don't have one) |

Projects also say `canManageMembers`: whether the requester can do this.

## Errors

Errors are JSON: `{ "error": "…" }`, plus `"problems"` (each with a `path` and `message`) when
submitted content is invalid.

| Status | Meaning |
| --- | --- |
| 400 | The request body is not valid JSON |
| 401 | No one is signed in |
| 403 | Not allowed |
| 404 | Not found (including records the requester can't read) |
| 409 | Conflicts with the record's current state (e.g. saved by someone else meanwhile, or signed) |
| 422 | Invalid, e.g. content not in the content format |
| 500 | Something went wrong on the server (details are logged, not sent) |
| 502 | ORCID didn't complete a sign-in |
| 503 | Sign-in with ORCID isn't set up on this server |
