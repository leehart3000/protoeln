# Deployment

ProtoELN runs on [Cloudflare Workers](https://developers.cloudflare.com/workers/), with its data
in MongoDB Atlas. One Worker (`backend/src/worker.ts`, set up in `backend/wrangler.jsonc`)
serves the website's files and passes requests to `/api` to the API, so both share one address,
as in development.

The API is the same Express app as under Node.js. It runs in one
[Durable Object](https://developers.cloudflare.com/durable-objects/), which keeps its MongoDB
connection open between requests: a plain Worker can't reuse a connection from one request in
the next, so it would have to connect to Atlas afresh (about 300 ms) for every request. The
Durable Object is placed in western Europe, near the Atlas cluster in AWS Ireland. Mongoose 9
and later run on Workers with Node.js compatibility turned on.

| Site | Address | Database | ORCID |
| --- | --- | --- | --- |
| Staging | https://staging.protoeln.org | `protoeln-staging` | Sandbox |
| Production (later) | https://protoeln.org | `protoeln` | Production |

## Trying it locally first

```sh
just worker-dev
```

builds the website and runs it with the API as Cloudflare will, at http://127.0.0.1:8787. It
reads its settings from `backend/.env`, so it uses the development database. Signing in there
goes back to the usual development address.

## Settings

Settings that aren't secret are in `wrangler.jsonc` (`vars`). The others are Worker secrets, set
once with Wrangler, which asks for each value (so it never appears in the terminal's history):

```sh
cd backend
pnpm exec wrangler secret put PROTOELN_MONGODB_URI
pnpm exec wrangler secret put PROTOELN_ORCID_CLIENT_ID
pnpm exec wrangler secret put PROTOELN_ORCID_CLIENT_SECRET
pnpm exec wrangler secret put PROTOELN_SITE_ADMINS
```

- **MongoDB:** staging has its own Atlas database user, which can only read and write the
  `protoeln-staging` database. Workers don't connect from fixed IP addresses, so the Atlas
  project's network access list must allow connections from anywhere (`0.0.0.0/0`); the
  database user's long, random password is what keeps others out.
- **ORCID:** staging uses the sandbox client, which needs the redirect URI
  `https://staging.protoeln.org/api/v1/auth/orcid/callback`.

## Deploying

```sh
just deploy
```

runs every check, builds the website, and deploys the Worker to `staging.protoeln.org`.
Cloudflare sets up the address and its certificate the first time.
