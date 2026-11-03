# Running ProtoELN locally

You need Node.js 24 (via fnm), pnpm and `just`, as in ProtoLIMS.

## Settings

The API reads its settings from environment variables, or from `backend/.env`, which git
ignores. Copy `backend/.env.example` to `backend/.env` and fill it in:

- **MongoDB**: the connection string of the Atlas cluster (Connect → Drivers) and the database
  to use (`protoeln-dev` for development). Atlas only accepts connections from IP addresses on
  the project's access list.
- **ORCID**: the sandbox client's ID and secret. The client needs the redirect URI
  `http://127.0.0.1:5174/api/v1/auth/orcid/callback`.

## Running

In two terminals:

```sh
just backend-dev
```

```sh
just web-dev
```

Then open **http://127.0.0.1:5174**. ORCID only sends you back to that address, and cookies
belong to a host name, so signing in from `localhost` first moves you to `127.0.0.1`.

The website runs on port 5174 and the API on 3000. The website passes requests for `/api` to
the API, so both share one address, as they will when deployed. ProtoLIMS uses ports 5173 and
8000, so both can run at once.

## Checks

```sh
just check
```

runs everything CI runs: formatting, linting, type-checking and tests with coverage, for the
content package, the backend and the frontend. Tests use a temporary MongoDB server, never Atlas.
