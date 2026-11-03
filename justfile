# ProtoELN task runner. Run `just` on its own to list the recipes.
# backend-*, web-* and content-* recipes do one part; lint, format, typecheck, test and check do all.

api := "pnpm --dir backend"
web := "pnpm --dir frontend"
content := "pnpm --dir packages/content"

# List available recipes
default:
    @just --list --unsorted

# --- Everything ---

# Install all packages (they share one lockfile at the repo root)
install:
    pnpm install

# Fix lint issues everywhere
lint: content-lint backend-lint web-lint

# Format everything
format: content-format backend-format web-format

# Type-check everything
typecheck: content-typecheck backend-typecheck web-typecheck

# Run all the tests
test: content-test backend-test web-test

# Run every check CI runs, everywhere, without changing any files
check:
    pnpm install --frozen-lockfile
    just content-check
    just backend-check
    just web-check

# --- Content format (packages/content, shared by backend and frontend) ---

# Fix content package lint issues with ESLint
content-lint:
    {{content}} lint:fix

# Format the content package with Prettier
content-format:
    {{content}} format

# Type-check the content package
content-typecheck:
    {{content}} typecheck

# Run the content package tests; extra arguments go to Vitest
content-test *args:
    {{content}} test {{args}}

# Run every content package check CI runs, without changing any files
content-check:
    {{content}} format:check
    {{content}} lint
    {{content}} typecheck
    {{content}} coverage

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
