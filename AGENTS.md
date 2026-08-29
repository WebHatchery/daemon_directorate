# WebHatchery Game App Standards

This file is copied into each game app root during publish.

For the full shared-library adoption workflow and migration checklist, see
`SHARED_LIBRARIES_AND_APP_PRACTICES.md`.

## Backend Standards (PHP)

- Keep `composer.json` minimal with scripts: `start`, `test`, `cs-check`, `cs-fix`.
- Use shared Web Hatchery Login only; no local login endpoints or redirects.
- Return `401` with `login_url` for unauthenticated requests.
- Validate Bearer tokens with shared services.
- Follow the Architecture pattern:
  - Actions: business logic, validation, persistence orchestration.
  - Controllers: thin HTTP handlers delegating to Actions.
  - Models: DTOs with `toArray()`.
  - Repositories: raw PDO, prepared statements only.
  - Services: complex business logic.
- Use `declare(strict_types=1)` and PascalCase classes, camelCase members/methods.
- SQL files must live under `backend/` (`backend/database/` or `backend/migrations/`).
- Any schema/seed changes include ordered, repeatable-safe migrations in backend.
- No direct DB queries outside repositories.
- No business logic in controllers.
- Environment variables must be explicit with no defaults/fallback values.

## Frontend Standards (React/TypeScript)

- React 19, Vite, TypeScript strict mode.
- Zustand with `persist` for state.
- Tailwind CSS and Framer Motion.
- Axios for API calls and centralized API client.
- React Router for routing.
- Use `class` for runtime exports (errors/responses), `type`/`interface` for typed shapes.
- Feature-based source layout:
  - `src/api`
  - `src/components`
  - `src/hooks`
  - `src/stores`
  - `src/types`
  - `src/data`
  - `src/utils`
- Shared Web Hatchery auth store and interceptor-based token handling.
- Handle `401` by setting login URL (no redirects).
- Component guidance:
  - Functional components with typed props.
  - Keep components focused; compose instead of growing large.
  - Avoid inline styles; use Tailwind utility classes.
  - No direct `localStorage`; use Zustand `persist`.
  - No prop drilling for cross-cutting app state.
- Maintain clear CI: lint, type-check, test, build.
