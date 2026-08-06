# Evidence Frontend Start

Implement the complete frontend against the fixed SDK and live backend. Do not perform the review yet.

Read `AGENTS.md` and every document under `.agents/skills/frontend/` and `.agents/skills/evidence/` in full before working, and obey them throughout.

Start `pnpm dev` from `packages/frontend` before implementation while every frontend claim is disabled, and keep it running through Overall Final.

Unlock each claim when its layer completes and before the next begins, in the hook, screen, journey order `.agents/skills/evidence/frontend.md` prescribes. Neither earlier nor later. The claims live in `packages/frontend/lint.config.ts`.

Write every `@evidence` and `@evidenceExclude` truthfully; never add a tag only to remove a compiler diagnostic.

## Final Checklist

- [ ] Every required domain hook, screen, state, interaction, and journey implemented.
- [ ] Every frontend claim is enabled; no other claim configuration changed.
- [ ] Each layer's claims were unlocked when that layer completed and before the next began: hooks first, then screens, then journeys; no claim was carried past its own layer.
- [ ] Every accessor is called by a hook and every hook used by a screen; every screen is walked or excluded with a reviewed reason.
- [ ] Every `@evidence` names what its host actually calls, delivers, uses, proves, or walks.
- [ ] Every `@evidenceExclude` sits in its claim's exclusion carrier, names its owner or alternative and invalidating condition, and none stands in for work this layer owes or exists only to remove a diagnostic.
- [ ] The persistent frontend `pnpm dev` process reloaded without diagnostics after the latest change and remains running.
- [ ] `pnpm plan` reports every requirement section named by a screen entry or an omission.
- [ ] Every screen driven in the interactive browser, with `packages/frontend/wiki/interactive-review.md` recording the screens, widths, observations, and defects found.
- [ ] Live-backend `pnpm test:e2e` exits with code 0 after the last frontend change.

Any unchecked item leaves the Goal active. Complete that item before proceeding.
