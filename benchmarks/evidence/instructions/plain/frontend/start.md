# Frontend Start

This stage owns only the complete first implementation of the frontend and its live integration. Do not perform the review yet.

Read `AGENTS.md` and every document under `.agents/skills/frontend/` in full before working, and obey them throughout, including the implementation order.

Ensure `pnpm dev` is running from `packages/backend`. Start `pnpm dev` from `packages/frontend` as a persistent background process before implementation, monitor both processes, and keep them running through Overall Final.

## Final Checklist

- [ ] Every required domain hook, screen, state, interaction, and browser journey implemented.
- [ ] Every published SDK accessor is called by a hook and every hook is used by a screen; every screen is walked by a journey or has a recorded requirement-backed reason.
- [ ] Every upstream correction regenerated the SDK and re-passed the backend gate.
- [ ] Backend and frontend processes reloaded cleanly after the latest scoped change.
- [ ] `pnpm plan` reports every requirement section named by a screen entry or an omission.
- [ ] Every screen driven in the interactive browser, with `packages/frontend/wiki/interactive-review.md` recording the screens, widths, observations, and defects found.
- [ ] Live-backend `pnpm test:e2e` passed against the current implementation.

Any unchecked item leaves the Goal active. Complete it and rerun every affected current-state gate.
