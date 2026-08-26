# Frontend Guide

## Purpose

`frontend/` contains the Next.js frontend for the Project Management MVP. It currently runs as a frontend-only Kanban demo; backend integration, authentication, persistence, and AI chat are planned phases.

## Structure

- `src/app/`: App Router entry points and global styles.
  - `page.tsx` renders the Kanban board.
  - `layout.tsx` defines the document shell.
  - `globals.css` contains global styles and the project color variables.
- `src/components/`: React UI components.
  - `KanbanBoard.tsx` owns the demo board state and drag-and-drop behavior.
  - `KanbanColumn.tsx` renders a column and its card controls.
  - `KanbanCard.tsx` renders editable card content.
  - `KanbanCardPreview.tsx` renders the drag overlay.
  - `NewCardForm.tsx` renders the add-card form.
- `src/lib/`: Typed domain helpers and their unit tests.
  - `kanban.ts` defines `Card`, `Column`, and `BoardData`, seed data, ID creation, and card movement.
- `tests/`: Playwright end-to-end tests.
- `public/`: Static assets.
- `vitest.config.ts`, `playwright.config.ts`, and `eslint.config.mjs`: test and lint configuration.

## Development

```bash
npm install
npm run dev
```

Available checks:

```bash
npm run lint
npm run test:unit
npm run test:e2e
npm run test:all
npm run build
```

## Conventions

- Use TypeScript and existing React/Next.js patterns.
- Keep board domain types and pure operations in `src/lib/kanban.ts`.
- Keep interactive components client-side where hooks or dnd-kit require them.
- Use the existing CSS variables and Tailwind classes rather than introducing a separate design system.
- Preserve stable `data-testid` values used by Playwright tests when changing board markup.
- Add focused unit tests for pure logic and component tests for UI behavior; add Playwright coverage for user-visible flows.
- Do not put secrets or backend-only configuration in frontend code.
