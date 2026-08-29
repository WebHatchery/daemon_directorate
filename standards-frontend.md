# WebHatchery Frontend Standards

These standards apply to every frontend in this game apps root.

## Stack

- Use React 19, Vite, and TypeScript strict mode.
- Use Tailwind CSS for styling and Framer Motion for motion.
- Use Zustand with `persist` for auth, game, and cross-route state.
- Use Axios for HTTP and React Router for routing.

## Project Structure

```text
src/
├── api/          # Axios client and service calls
├── components/   # Feature-based components, PascalCase
├── hooks/        # Reusable logic, camelCase
├── stores/       # Zustand stores, camelCase
├── types/        # TypeScript definitions, camelCase
├── data/         # Static data, kebab-case
└── utils/        # Helpers, camelCase
```

## Components

- Use functional components typed as `React.FC`.
- Define props with `interface` unless there is a specific reason to use `type`.
- Keep components focused; split components that grow beyond roughly 150 lines.
- Prefer composition over prop drilling; shared state belongs in Zustand stores.
- Do not manipulate the DOM directly.

## Types And Exports

- Use `class` for runtime exports such as API responses and errors.
- Use `type` or `interface` only for compile-time types.
- Do not use `any`; model unknown data explicitly and narrow it safely.

## API And Auth

- Keep one centralized Axios client per frontend.
- Add Bearer tokens through Axios interceptors.
- Handle `401` responses by storing the provided `login_url`; do not redirect automatically.
- Use shared WebHatchery auth state and login integration.
- Do not create local login forms, login routes, or custom auth redirects.
- Environment variables must be explicitly configured; never provide code defaults or fallback values for env reads.

## State

- Use Zustand with `persist` instead of direct `localStorage` access.
- Keep game state serializable where practical.
- Separate auth state from feature-specific game state.

## Styling

- Use Tailwind classes instead of inline styles.
- Keep visual decisions inside components or reusable UI primitives, not scattered constants.
- Preserve each game's visual identity while keeping shared technical standards consistent.

## Required Checks

- `npm run type-check` or equivalent TypeScript validation.
- `npm run lint` or equivalent lint check.
- `npm run test` when tests exist.
- `npm run build` before publishing.
