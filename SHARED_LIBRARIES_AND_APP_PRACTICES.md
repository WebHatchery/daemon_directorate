# Applying the `apps` platform to `game_apps`

Status: adoption guide  
Last reviewed: 2026-08-23  
Audience: developers migrating or creating WebHatchery game apps

This document explains how game apps should consume the shared libraries and
engineering contracts already established in `D:\WebHatchery\apps`. It is the
implementation guide for bringing `game_apps` onto the same platform without
changing each game's domain rules or visual identity.

The minimum standards in `docs/standards-frontend.md`,
`docs/standards-backend.md`, and `AGENTS.md` still apply. This guide adds the
missing details: where the shared packages live, how to wire them into a game,
which responsibilities remain app-owned, and how to verify the result.

## Current repository state

The platform boundary is the root workspace, `D:\WebHatchery`:

- `D:\WebHatchery\package.json` owns the frontend workspace list and shared
  dependency versions. It already includes `game_apps/*/frontend`.
- `D:\WebHatchery\package-lock.json` is the only frontend lockfile that should
  be used for workspace builds.
- `D:\WebHatchery\packages\webhatchery-auth-react` provides shared React auth
  and guest-session behavior.
- `D:\WebHatchery\packages\webhatchery-api-client` provides shared browser API
  transport, bearer-token handling, envelopes, errors, timeouts, and queries.
- `D:\WebHatchery\packages\webhatchery` provides shared PHP auth, HTTP,
  environment, bootstrap, logging, and error contracts.
- `D:\WebHatchery\publish.ps1` builds workspace frontends and copies the shared
  PHP package into the deployed vendor snapshot.

At the time of this review, active game app source code did not yet import the
shared frontend packages. Most games still have local auth/session and Axios
implementations, so migrations should be planned as incremental replacements.
The existing game behavior should remain intact while transport and platform
concerns move to the shared packages.

## Platform ownership rules

| Concern | Shared platform owns | Game app owns |
| --- | --- | --- |
| Browser auth | Frontpage token discovery, guest sessions, login/signup URLs, token provider wiring, guest-link transport | User display, route-level access decisions, game-specific merge rules |
| API transport | URL joining, bearer headers, JSON envelopes, typed errors, timeout, query serialization, 401 metadata | Endpoint names, request/response types, domain actions |
| PHP auth | JWT verification, claim normalization, bearer extraction, common 401 response | Local user lookup, guest validity, ownership and role policy |
| HTTP responses | Common success/error/unauthorized shape and request correlation | Domain error codes, validation messages, action results |
| Persistence | No domain storage policy is imposed by a library | Decide whether each field is server, draft, cache, preference, or offline queue |
| Gameplay | Nothing | All game rules, state transitions, balance, content, and saves |

Do not move game rules into a shared package just because two games currently
look similar. Share transport and stable platform contracts; keep product and
gameplay decisions close to the game.

## 1. Use the root workspace

Run frontend dependency installation from the root only:

```powershell
Set-Location D:\WebHatchery
npm ci
```

Do not run `npm install` inside `game_apps\<game>\frontend`, create a second
lockfile, or copy a version of a shared package into an individual game. The
root manifest and lockfile are the source of truth. Game frontend manifests
may retain app-specific dependencies, but shared platform packages must be
resolved through the root workspace.

The shared packages are imported by their public names:

```ts
import { createAuth } from '@webhatchery/auth-react';
import { createApiClient } from '@webhatchery/api-client';
```

Do not import from `packages/.../src`, `dist`, or another app's source tree.

## 2. Configure explicit environment values

Every game that uses the platform API/auth contract should define these values
in its checked-in environment templates and provide preview/production values
through the normal publish process:

```dotenv
VITE_API_BASE_URL=/game_slug
VITE_API_VERSION=v1
VITE_WEB_HATCHERY_LOGIN_URL=https://webhatchery.au/login
VITE_WEB_HATCHERY_SIGNUP_URL=https://webhatchery.au/signup
```

The exact API base URL is app-specific. Do not add fallback values such as
`|| ''`, `?? 'http://localhost...'`, or hard-coded production URLs in source.
Missing configuration must fail clearly at startup/build time.

A small helper is appropriate for frontend environment reads:

```ts
export function requiredEnv(
  value: string | undefined,
  name: string,
  allowEmpty = false,
): string {
  if (!allowEmpty && (!value || value.trim() === '')) {
    throw new Error(`${name} must be configured.`);
  }

  return value?.trim() ?? '';
}
```

`allowEmpty` is only for intentionally empty values such as an API version
when the supplied base URL already contains `/api/v1`. It is not a general
fallback mechanism.

For PHP, use `WebHatchery\Environment\Environment::required()` after loading
the environment. Never supply database, JWT, login URL, or service defaults in
application code.

## 3. Replace local frontend API clients

`@webhatchery/api-client` is the default client for JSON API calls. It:

- joins the configured base URL and endpoint safely;
- chooses a full WebHatchery bearer token before an app guest token;
- serializes JSON bodies and query parameters;
- unwraps `{ success: true, data: ... }` responses by default;
- raises a typed `ApiError` for HTTP and API-envelope failures;
- preserves `login_url`, `request_id`, `error_code`, and safe error details;
- applies a timeout and supports JSON, text, and blob responses;
- never clears auth storage or redirects after a 401.

Create one client in `frontend/src/api/client.ts` and make feature services
call that client. Do not create a new Axios instance per feature.

```ts
import {
  createApiClient,
  resolveApiRootUrl,
  type TokenProvider,
} from '@webhatchery/api-client';

function requiredEnv(value: string | undefined, name: string, allowEmpty = false): string {
  if (!allowEmpty && (!value || value.trim() === '')) {
    throw new Error(`${name} must be configured.`);
  }

  return value?.trim() ?? '';
}

const api = createApiClient({
  baseURL: resolveApiRootUrl(
    requiredEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
    requiredEnv(import.meta.env.VITE_API_VERSION, 'VITE_API_VERSION', true),
  ),
  guestAuthStorageKey: 'game-slug-guest-session',
});

export function setTokenProvider(provider: TokenProvider | null): void {
  api.setTokenProvider(provider);
}

export default api;
```

Feature API modules should be typed and small:

```ts
import api from './client';

export interface PlayerSave {
  id: string;
  revision: number;
  state: Record<string, unknown>;
}

export function loadPlayerSave(): Promise<PlayerSave> {
  return api.get<PlayerSave>('/saves/current');
}

export function savePlayerState(state: Record<string, unknown>): Promise<PlayerSave> {
  return api.put<PlayerSave>('/saves/current', { state });
}
```

The client returns the `data` member for a successful envelope. Use
`preserveEnvelope: true` only when a migration or a feature genuinely needs
the complete response envelope.

Direct `fetch` is reserved for documented exceptions such as a browser file
download, static asset loading, or telemetry that is not an API adapter. If a
JSON endpoint is called more than once, it belongs behind the shared client.

## 4. Replace local auth/session implementations

`@webhatchery/auth-react` is the canonical React auth integration. It supports
both a full WebHatchery account and an app-owned guest session.

Each game must use a unique guest storage key. The shared frontpage key is
`auth-storage`; the game guest key must be namespaced, for example
`dragons-den-guest-session`.

The package owns:

- reading the full-account token from the shared frontpage store;
- creating and persisting a guest session;
- refreshing `/auth/current-user`;
- building user-initiated login and signup URLs with a `redirect` parameter;
- carrying `guest_user_id` through account creation/sign-in;
- previewing and submitting guest-data linking;
- registering the active token provider with the API client;
- keeping a 401 session intact so the app can show recovery UI.

The game supplies its user type, endpoint paths, environment values, and any
normalization needed for its local user shape:

```tsx
import {
  buildApiUrl,
  createAuth,
} from '@webhatchery/auth-react';
import { setTokenProvider } from '../api/client';

interface GameUser {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  role?: string | null;
  is_guest?: boolean;
  auth_type?: 'frontpage' | 'guest';
}

const { AuthProvider, useAuth } = createAuth<GameUser>({
  guestAuthStorageKey: 'game-slug-guest-session',
  preferredAuthModeStorageKey: 'game-slug-auth-mode',
  loginUrl: requiredEnv(
    import.meta.env.VITE_WEBHATCHERY_LOGIN_URL,
    'VITE_WEBHATCHERY_LOGIN_URL',
  ),
  signupUrl: requiredEnv(
    import.meta.env.VITE_WEBHATCHERY_SIGNUP_URL,
    'VITE_WEBHATCHERY_SIGNUP_URL',
  ),
  buildApiUrl: (path) => buildApiUrl(
    requiredEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
    requiredEnv(import.meta.env.VITE_API_VERSION, 'VITE_API_VERSION', true),
    path,
  ),
  setTokenProvider,
});

export { AuthProvider, useAuth };
```

Wrap the application once near the root:

```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

Use `useAuth()` for sign-in, guest play, account linking, logout, loading, and
user display. A migrated game should not retain a second `AuthContext`,
`auth/session.ts`, or custom token parser except for a clearly documented data
migration adapter.

Important 401 behavior:

- An API 401 is an API result, not permission for automatic logout.
- Preserve both the full-account and guest session records.
- Store or display the returned `login_url` through app UI state.
- Let the player choose when to call `loginWithRedirect()`.
- Never call `window.location.assign()` or `window.location.href` from an API
  response interceptor merely because a request returned 401.

The shared auth package provides guest-link transport, but each game must still
define deterministic rules for `keep_account`, `guest_wins`, and `merge` when
its game data is persisted remotely or locally.

## 5. Use the common API response contract

Successful JSON responses should have this shape:

```json
{
  "success": true,
  "data": {},
  "request_id": "request-id"
}
```

Errors should be safe, structured, and machine-readable:

```json
{
  "success": false,
  "error_code": "validation_error",
  "message": "The selected character is not available.",
  "details": {},
  "request_id": "request-id"
}
```

Protected routes return HTTP 401 and include `login_url`:

```json
{
  "success": false,
  "error_code": "unauthorized",
  "message": "Authentication required.",
  "login_url": "https://webhatchery.au/login",
  "request_id": "request-id"
}
```

Do not return HTML, PHP warnings, stack traces, or a silent empty success for
an API error.

## 6. Adopt the shared PHP package

The shared package namespace is `WebHatchery\`. It provides:

- `WebHatchery\Auth\AuthUser` and `JwtAuthenticator`;
- `WebHatchery\Middleware\JwtAuthMiddleware`;
- `WebHatchery\Http\RequestHeaders` and `JsonResponder`;
- `WebHatchery\Core\Bootstrap`, `ErrorResponder`, request context, and safe
  logging;
- `WebHatchery\Environment\Environment` for required configuration.

Game backends should use the central vendor/autoloader supplied by the root
workspace and publish process. Do not copy the shared package into a game
source tree and do not run a separate `composer install` for normal publish.
The game backend may retain a small Composer manifest for app-specific
metadata and scripts, but the root Composer dependency set is authoritative.

The local entry point should load the central autoloader before constructing
the router. Existing `blacksmith_forge/backend/public/index.php` shows the
central-autoloader pattern. The deployed publish process also places the
shared package at `vendor/kalaith/webhatchery` for the deployed autoloader.

### Shared JWT middleware adapter

The app should keep only the persistence adapter and pass it to the shared
middleware:

```php
<?php

declare(strict_types=1);

namespace App\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use WebHatchery\Environment\Environment;
use WebHatchery\Middleware\JwtAuthMiddleware as SharedJwtAuthMiddleware;

final class JwtAuthMiddleware implements MiddlewareInterface
{
    private SharedJwtAuthMiddleware $shared;

    public function __construct()
    {
        $this->shared = new SharedJwtAuthMiddleware(
            Environment::required('JWT_SECRET'),
            Environment::required('WEBHATCHERY_LOGIN_URL'),
            fn (object $claims, array $authUser): ?array => $this->resolveLocalUser($claims),
            fn (string $guestId, object $claims): bool => $this->guestIsValid($guestId),
        );
    }

    public function process(Request $request, Handler $handler): Response
    {
        return $this->shared->process($request, $handler);
    }

    /** @return array<string, mixed>|null */
    private function resolveLocalUser(object $claims): ?array
    {
        // Resolve the full-account user using this game's repository.
        // Return an array containing at least a stable `id`, or null.
        return null;
    }

    private function guestIsValid(string $guestId): bool
    {
        // Check this game's guest-session record and revocation/expiry policy.
        return $guestId !== '';
    }
}
```

The shared middleware attaches normalized `user_id`, `user`, and `auth_user`
request attributes. Local lookup, guest-session validation, and ownership
checks remain app-owned. Do not reimplement JWT decoding or bearer header
parsing in every game.

### Shared JSON responses and environment

```php
use WebHatchery\Http\JsonResponder;

$responder = new JsonResponder($app->getResponseFactory());

return $responder->success($record);
// or:
return $responder->error(422, 'Invalid move.', 'validation_error');
```

Use `WebHatchery\Core\Bootstrap::loadEnvironment()` and
`WebHatchery\Environment\Environment::required()` in the entry point where
appropriate. Keep controllers thin: parse the request, call an Action, and
return a responder result.

## 7. Keep backend architecture predictable

Use this flow for new or migrated backend features:

```text
HTTP route
  -> thin Controller
    -> Action (validation + orchestration)
      -> Service (complex reusable rules, if needed)
        -> Repository (prepared SQL/PDO)
          -> Model/DTO::toArray()
```

Rules:

- Every PHP file starts with `declare(strict_types=1)`.
- Classes use PascalCase; methods and properties use camelCase.
- Controllers do not contain business logic or direct SQL.
- Repositories own raw PDO and always use prepared statements.
- Models are simple typed DTOs with `toArray()`.
- Actions own validation, persistence decisions, and multi-step mutations.
- Services hold complex reusable logic that is not transport-specific.
- App routes are versioned under `/api/v1`.
- Expose `GET /api/v1/health` and, where the deployment requires it,
  `GET /health`.
- Return safe JSON errors with appropriate HTTP status codes.

Keep schema, seed, and migration SQL under `backend/database/` or
`backend/migrations/`. Every schema or seed change must include an ordered,
descriptive migration, for example:

```text
backend/migrations/001_create_game_tables.sql
backend/migrations/002_add_guest_saves.sql
```

Make migrations repeatable-safe where practical and document manual production
steps in the backend README. Never add app SQL to the game root.

## 8. Make data ownership explicit

Before choosing Zustand persistence, classify every persisted field:

| Label | Meaning | Typical game example |
| --- | --- | --- |
| `server` | Backend/database is authoritative | Cloud save, inventory, account progress |
| `draft` | Unsaved browser input | Character creation form in progress |
| `cache` | Re-fetchable API data | Leaderboard or profile preview |
| `preference` | Browser-only UX choice | Sound setting, selected tab |
| `offline_queue` | Pending server mutation with replay rules | Offline purchase awaiting sync |

Server-owned data may be cached locally, but the cache must not become a
second mutation source. After a successful mutation, invalidate or update the
relevant cache. Surface revision or ownership conflicts instead of overwriting
silently.

For intentionally local/offline games, local game state is allowed when the
README and store types say so. It is still feature state, not authentication
state, and should be persisted through Zustand:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
  gold: number;
  addGold: (amount: number) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      gold: 0,
      addGold: (amount) => set((state) => ({ gold: state.gold + amount })),
    }),
    { name: 'game-slug-game-state', version: 1 },
  ),
);
```

Do not use direct `localStorage` in feature components or stores. The shared
auth package may read its documented auth keys internally; that is not a model
for app feature persistence. If an existing game has legacy save keys, add a
versioned migration and document the ownership decision.

## 9. Frontend structure and code quality

Use the feature-based layout as the default:

```text
frontend/src/
├── api/          # Shared client and typed service calls
├── components/   # Focused feature components, PascalCase
├── hooks/        # Reusable hooks, camelCase
├── stores/       # Zustand stores, camelCase
├── pages/        # Route-level screens
├── types/        # TypeScript types and interfaces
├── data/         # Static game data, kebab-case
└── utils/        # Small pure helpers
```

Keep the game's visual system intact while following these implementation
rules:

- React 19, Vite, and strict TypeScript.
- Zustand with `persist` for persisted app/game state.
- Tailwind classes instead of inline styles.
- Framer Motion for motion where the game needs it.
- React Router for routing where multiple screens require it.
- Functional components with typed props.
- Prefer composition and Zustand over prop drilling for cross-route state.
- Split components that grow beyond roughly 150 lines.
- No `any`; use `unknown` and narrow it safely.
- Use `class` for runtime exports such as `ApiError`; use `type` or
  `interface` for compile-time shapes.
- Do not manipulate the DOM directly.
- Keep API calls out of presentational components.

## 10. Verification and publishing

From `D:\WebHatchery`, verify a frontend workspace without installing inside
the game:

```powershell
npm --workspace game_apps/<game_slug>/frontend run lint
npm --workspace game_apps/<game_slug>/frontend run type-check
npm --workspace game_apps/<game_slug>/frontend run test:run
npm --workspace game_apps/<game_slug>/frontend run build
```

For a backend, run its declared contracts from the backend directory:

```powershell
composer run-script cs-check
composer run-script test
```

The backend must also have PHP syntax checks and at least one substantive test
with an assertion. New auth and save flows should include contract tests for
valid tokens, invalid/expired tokens, guest sessions, ownership, and 401
payloads.

After code changes, publish from the game root:

```powershell
Set-Location D:\WebHatchery\game_apps\<game_slug>
.\publish.ps1
```

The published preview is served at:

```text
http://127.0.0.1/<game_slug>/
```

Use `.\publish.ps1 -DryRun` when checking publish behavior without copying
files. Verify the published URL, not a Vite or PHP built-in server URL. The
publish process also syncs the shared `game_apps/docs` files into the game
root, builds from the root workspace, and includes the shared PHP package in
the deployed vendor snapshot.

## 11. Migration order for an existing game

Use this order so each step leaves the game runnable:

1. **Classify the game.** Record whether it is frontend-only or full-stack and
   whether its authoritative state is local or server-owned.
2. **Join the root workspace.** Confirm the frontend is included by the root
   workspace and remove any plan to install shared packages locally.
3. **Normalize environment values.** Add explicit API/auth values and remove
   source-level fallbacks.
4. **Replace the API adapter.** Route JSON calls through one
   `@webhatchery/api-client` instance and add typed feature services.
5. **Replace auth plumbing.** Use `createAuth`, a unique guest key, and the
   shared token provider. Keep game-specific user normalization only where it
   is necessary.
6. **Align 401 UI.** Preserve sessions, store/display `login_url`, and remove
   automatic interceptor redirects.
7. **Adopt backend contracts.** Load the central vendor, wrap the shared JWT
   middleware with local lookup/guest callbacks, and use `JsonResponder`.
8. **Move domain logic into layers.** Extract controller logic into Actions,
   Services, Repositories, and DTOs as needed.
9. **Classify persisted state.** Add `server`, `draft`, `cache`, `preference`,
   or `offline_queue` ownership labels and migrate legacy save keys safely.
10. **Add or update migrations and tests.** Keep SQL under `backend/` and add
    auth/save contract tests.
11. **Run quality gates and publish.** Run lint, type-check, tests, build, and
    the published preview smoke test.
12. **Document intentional exceptions.** A local-only game, download adapter,
    or legacy migration bridge should be named in the game README with a
    removal or review condition.

## Per-game definition of done

Use this checklist in the game app's migration issue or README:

- [ ] Game classification and data ownership are documented.
- [ ] Frontend builds through the root workspace and uses no second lockfile.
- [ ] `@webhatchery/api-client` owns JSON API transport.
- [ ] `@webhatchery/auth-react` owns frontpage/guest auth where auth is needed.
- [ ] Guest storage keys are unique to the game.
- [ ] API 401s preserve sessions and expose `login_url` to UI state.
- [ ] Required environment values have no code fallbacks.
- [ ] Backend uses the shared PHP package when it has a PHP API.
- [ ] Protected routes return the common 401 JSON contract.
- [ ] Controllers are thin and repositories use prepared statements.
- [ ] SQL lives under `backend/database` or `backend/migrations`.
- [ ] Persisted fields have an explicit ownership label.
- [ ] Frontend has `lint`, `type-check`, `test:run`, and `build` scripts.
- [ ] Backend has `test`, `cs-check`, and PHP syntax coverage.
- [ ] The game passes a publish dry run and a published preview smoke test.
- [ ] Any exception is documented with an owner and follow-up condition.

## Related source contracts

These files remain the canonical implementation references:

- `D:\WebHatchery\apps\PLATFORM_CONTRACTS.md`
- `D:\WebHatchery\apps\DATA_OWNERSHIP.md`
- `D:\WebHatchery\apps\AUTHENTICATION_ROLLOUT.md`
- `D:\WebHatchery\apps\IMPLEMENTATION_GUIDE.md`
- `D:\WebHatchery\packages\webhatchery-auth-react\README.md`
- `D:\WebHatchery\packages\webhatchery-api-client\README.md`
- `D:\WebHatchery\packages\webhatchery\README.md`
- `D:\WebHatchery\game_apps\docs\standards-frontend.md`
- `D:\WebHatchery\game_apps\docs\standards-backend.md`
