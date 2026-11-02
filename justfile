# ProtoELN task runner. Run `just` on its own to list the recipes.
# web-* recipes do the frontend; lint, format, typecheck, test and check do every part
# (backend-* recipes will join them once the backend exists).

web := "pnpm --dir frontend"

# List available recipes
default:
    @just --list --unsorted

# --- Everything ---

# Install all packages (frontend and backend share one lockfile at the repo root)
install:
    pnpm install

# Fix lint issues
lint: web-lint

# Format the code
format: web-format

# Type-check the code
typecheck: web-typecheck

# Run the unit and component tests
test: web-test

# Run every check CI runs, without changing any files
check:
    pnpm install --frozen-lockfile
    just web-check

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
