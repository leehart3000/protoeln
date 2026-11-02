# ProtoELN task runner. Run `just` on its own to list the recipes.
# backend-* and web-* recipes do one half; lint, format, typecheck, test and check do both.

api := "pnpm --dir backend"
web := "pnpm --dir frontend"

# List available recipes
default:
    @just --list --unsorted

# --- Both halves ---

# Install all packages (backend and frontend share one lockfile at the repo root)
install:
    pnpm install

# Fix lint issues in the backend and frontend
lint: backend-lint web-lint

# Format the backend and frontend
format: backend-format web-format

# Type-check the backend and frontend
typecheck: backend-typecheck web-typecheck

# Run the backend and frontend tests
test: backend-test web-test

# Run every check CI runs, for both backend and frontend, without changing any files
check:
    pnpm install --frozen-lockfile
    just backend-check
    just web-check

# --- Backend ---

# Run the API locally, restarting when a file changes
backend-dev:
    {{api}} dev

# Fix backend lint issues with ESLint
backend-lint:
    {{api}} lint:fix

# Format the backend with Prettier
backend-format:
    {{api}} format

# Type-check the backend
backend-typecheck:
    {{api}} typecheck

# Run the backend tests; extra arguments go to Vitest, e.g. `just backend-test health`
backend-test *args:
    {{api}} test {{args}}

# Run every backend check CI runs, without changing any files
backend-check:
    {{api}} format:check
    {{api}} lint
    {{api}} typecheck
    {{api}} coverage

# --- Frontend ---

# Run the frontend development server
web-dev:
    {{web}} dev

# Fix frontend lint issues with ESLint
web-lint:
    {{web}} lint:fix

# Format the frontend with Prettier
web-format:
    {{web}} format

# Type-check the frontend
web-typecheck:
    {{web}} typecheck

# Run the frontend tests; extra arguments go to Vitest, e.g. `just web-test App`
web-test *args:
    {{web}} test {{args}}

# Run the end-to-end tests with Playwright; extra arguments go to Playwright
web-e2e *args:
    {{web}} test:e2e {{args}}

# Run every frontend check CI runs, without changing any files
web-check:
    {{web}} format:check
    {{web}} lint
    {{web}} typecheck
    {{web}} coverage

# Build the frontend for production
web-build:
    {{web}} build
