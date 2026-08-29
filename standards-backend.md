# WebHatchery Backend Standards

These standards apply to PHP backends in this game apps root.

## Stack And Setup

- Use PHP with `declare(strict_types=1)` in every PHP source file.
- Keep `composer.json` minimal and project-local.
- Required Composer scripts: `start`, `test`, `cs-check`, and `cs-fix`.
- Resolve shared dependencies through the root/shared vendor strategy where available.
- Fail fast when required config or environment variables are missing.
- Environment variables must be explicitly configured; never provide code defaults or fallback values for env reads.

## Authentication

- Use shared WebHatchery Login only.
- Do not add local login endpoints, local login UI, or login redirects.
- Return `401` with a `login_url` for unauthenticated requests.
- Validate Bearer tokens through shared WebHatchery auth services.

## Architecture

- Actions contain business logic, validation, orchestration, and persistence decisions.
- Controllers are thin HTTP handlers that parse requests, call Actions, and return responses.
- Models are simple DTOs with `toArray()`.
- Repositories own raw PDO data access.
- Services contain complex reusable business logic that does not belong in controllers.

## Data Access

- Use prepared statements for every database query.
- Keep SQL inside repositories.
- Do not query the database directly from controllers or views.
- Treat request input as untrusted until validated.

## SQL Files And Migrations

- Keep all application SQL files inside the relevant project's `backend/` folder.
- Preferred locations are `backend/database/` for baseline schemas/seeds and `backend/migrations/` for incremental changes.
- Do not place schema, seed, production init, or migration SQL files in the game root directory.
- Every backend change that requires database schema or seed-data changes must include a migration script in the backend tree.
- Use a consistent, sortable migration naming convention within each project, such as `001_create_tables.sql`, `002_add_guest_sessions.sql`, or `2026_05_04_add_guest_saves.sql`.
- Each migration should be focused on one logical change and include clear SQL comments when intent is not obvious.
- Migrations should be safe to rerun where practical, using guards such as `IF NOT EXISTS` or documented manual checks when the database engine does not support them cleanly.
- Backend README files should document how to run migrations and identify any manual production steps.

## Naming And Style

- Use PascalCase for classes.
- Use camelCase for methods and properties.
- Keep files small and purpose-specific.
- Prefer explicit exceptions and typed return values over silent failure.

## API Responses

- Return structured JSON consistently.
- Use appropriate HTTP status codes.
- Include actionable error messages without leaking secrets or internal traces.
- Keep auth failures consistent with the shared login flow.

## Required Checks

- `composer test`
- `composer cs-check`
- Any project-specific integration or API smoke tests.
