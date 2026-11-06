# The read-only lock

When `PROTOELN_READ_ONLY` is `true`, nothing in ProtoELN can be changed through the website
or the API, by anyone, until it's turned off again. It works as ProtoLIMS's lock does, and is
meant for the public demo at protoeln.org: its data should only change when you choose to
change it.

## What it does

While it's on:

- **Everything can still be read**, and people can sign in with ORCID and out again, and see
  their profile.
- **Every change is refused** with `423 Locked` and "This site is read-only at the moment, so
  nothing can be changed": projects, notebooks, entries, drafts, ticks, versions and members.
  That includes site admins. (`backend/src/http/read-only.ts` lists the few requests allowed:
  those that only read, and signing out.)
- **The website shows a lock** marked "Read-only" in the header. Buttons that would change
  something are greyed out, with the reason on hover; steps have no tick boxes; and a project's
  Members section is hidden.

It's a server setting rather than a button on the website, so only someone who can change the
Worker's settings in Cloudflare can lift it: a stolen website session can't.

## Turning it on and off

Locally, set `PROTOELN_READ_ONLY=true` in `backend/.env` and restart the API. On Cloudflare, it's
one of the Worker's settings (`vars` in `backend/wrangler.jsonc`), so it changes with a deploy.

## Importing data

Imports run as scripts that write to the database directly, not through the API, so the lock
doesn't stop them, and needn't be lifted for them.
