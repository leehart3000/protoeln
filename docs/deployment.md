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
- **Read-only lock:** `PROTOELN_READ_ONLY` (in `vars`) is `"false"` on staging, so it can be
  tried out fully. See `docs/read-only.md`.

## Who can reach staging

Staging can be written to, so it's behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/):
the whole address, website and API, asks for an email address on an allowed list, and emails a
one-time PIN. The Worker has no other address (`workers_dev` and `preview_urls` are off), so
Access can't be got round. Signing in with ORCID works behind it, as the browser carries
Access's cookie when ORCID sends it back.

## Security headers

Every response carries the same security headers as ProtoLIMS's (a content security policy that
lets pages run only the site's own scripts, no framing, and so on): the website's files from
`frontend/public/_headers`, and the API's from `backend/src/security-headers.ts`, which a test
checks match.

## Deploying

Every push to `main` deploys to `staging.protoeln.org` by itself, once all of GitLab CI's checks
have passed (the `deploy-staging` job in `.gitlab-ci.yml`; see "Automatic deploys" below). To
deploy by hand instead, for example from a branch,

```sh
just deploy
```

runs every check, builds the website, and deploys the Worker to `staging.protoeln.org`.
Cloudflare sets up the address and its certificate the first time. The website is built with
`VITE_APP_ENVIRONMENT=Staging`, so a gold "Staging" badge beside the logo shows it isn't the real
site ("Local" on your own computer; production will have none).

The new website is served straight away, but the API has been seen to take a few minutes to
move to the new code (it runs in a Durable Object, which Cloudflare restarts on its own
schedule). Until it has, requests the new website makes of the new API may be answered "Not
found"; wait a few minutes and try again.

## Automatic deploys

GitLab CI deploys with a Cloudflare API token that can only deploy Workers. It's set up once:

1. In the Cloudflare dashboard, go to My Profile, then API Tokens, and choose Create Token. Use
   the "Edit Cloudflare Workers" template. Under Account Resources choose your account, and
   under Zone Resources choose `protoeln.org` only. Create it, and copy the token (it's shown
   only once). Keep a copy in your password safe.
2. In GitLab, go to the project's Settings, then CI/CD, then Variables, and add two:
   - `CLOUDFLARE_API_TOKEN`: the token. Tick Protect variable, and choose "Masked and hidden".
   - `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID (shown on the Workers page; it isn't
     secret). Tick Protect variable, and choose "Masked".

"Protect variable" means only protected branches (`main` is one by default) can use them, so a
merge request can't. GitLab lists each deploy under Operate, then Environments, as `staging`.
