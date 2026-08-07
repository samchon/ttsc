# Frontend Verification

Compilation cannot prove that a control works, a journey completes, or the layout remains usable. Browser execution is part of completion.

## Programs

```text
packages/frontend/tests/
  journeys/            one spec per requirement-backed journey, run live
  contract/            typed-client smoke pass, run under simulation
  ui-review.spec.ts    production layout and interaction review
  readme.spec.ts       documentation screenshots
```

The package scripts build the production bundle before Playwright:

```bash
pnpm test:e2e
pnpm test:contract
pnpm ui:review
pnpm readme:screens
```

Playwright starts its own production preview server. Frontend tests do not boot, seed, or inspect the backend; live mode consumes a separately prepared backend.

## Journey Shape

Each file under `tests/journeys/` exports one async function and registers one Playwright test:

```ts
export async function journey_customer_checkout(page: Page): Promise<void> {
  // Walk the complete requirement flow.
}

test("customer checkout", async ({ page }) => {
  await journey_customer_checkout(page);
  await expect(page.getByRole("heading", { name: "Order confirmed" }))
    .toBeVisible();
});
```

Every requirement-backed journey maps to a function, and every function maps back to a requirement and actor. A journey performs the full sequence, including observable success and stated refusal paths.

Every screen is walked by some journey. A page that appears in no journey is unproven in the browser, and walking it closes the chain that starts at the generated accessor: an accessor is called by a hook, the hook is used by a screen, and the screen is walked here.

A screen may stay outside the journeys only on a reviewed decision that names what covers it instead and the condition that would invalidate that decision. "No journey needed" is a conclusion, not a reason.

## Simulation And Live Execution

The two modes prove different things, so they are two suites and not one suite run twice.

| Suite | Mode | What it may assert |
| --- | --- | --- |
| `tests/journeys/` | `pnpm test:e2e`, whose mode builds live, against backend `pnpm dev` | anything, and it must assert the concrete effect its requirement names |
| `tests/contract/` | `--mode contract`, which sets `VITE_API_SIMULATE=true` | that a screen reaches its typed client boundary and renders without error |

Under simulation the generated SDK answers with `typia.random`, so a value is type-correct and otherwise arbitrary. An assertion about a concrete effect cannot pass against it: not that the post just created appears under its title, not that the dashboard shows the totals it fetched. A suite required to be green in both modes can therefore contain only assertions that observe neither mode's data, which is a suite that proves nothing while reporting success.

**The live run is the gate.** The contract pass is an early check that the typed boundary is wired, and it is worth what it is worth: it cannot observe persistence, sessions, authorization, or any side effect. Never record it as live integration.

Generated simulation data does not reliably produce empty, refusal, boundary, or long-content states either. Inspect those through deterministic fixtures.

An effect assertion belongs in `tests/journeys/`. Quarantining one behind a mode check inside a registered test is the shape this split exists to remove, because the test registers, runs, and asserts nothing it names.

## State Gallery

Keep a development-only gallery under `src/components/dev/`, gated by `import.meta.env.DEV` and absent from production navigation. Render each screen's presentational states from fixtures:

- loading;
- initial and filtered empty;
- expected refusal;
- unexpected error and retry;
- long and boundary values; and
- successful post-mutation state.

Inspect the gallery during authoring at mobile, tablet, and desktop widths. Production `ui:review` separately inspects shipping screens.

## Interactive Review

Drive every main journey in an interactive browser against the live backend. The workspace provides one: a Playwright MCP server is attached to your session, so navigating, clicking, filling, resizing, and taking an accessibility snapshot are tools you already have.

For every screen, observe:

- the accessibility snapshot, and that each control's accessible name is the one a user is meant to hear rather than the primitive's default;
- each control causing its promised observable change;
- search, sort, pagination, page size, toggles, dialogs, and forms working;
- expected refusals arriving as something a user can act on;
- session and actor changes not leaking cached data;
- the layout at each required width; and
- copy and values matching the contract.

Turn every discovered defect into a stable browser assertion, and record the pass as `packages/frontend/wiki/interactive-review.md`: the date, the screens driven, the widths, what each control did, and every defect found with the assertion that now pins it. A screen absent from that record was not driven.

The accessibility snapshot is the one observation that pays for itself immediately. An input primitive with a hard-coded `aria-label` announces every field in the application by that one name, and the snapshot shows it in a single call while source reading and a passing suite both miss it.

## Record

Keep `packages/frontend/wiki/verification.md` current:

```markdown
## Environment

- Production frontend build
- Backend running at the configured API host
- Built with no mode, so the SDK is live

## Automated

- `pnpm test:e2e` (live)
- `pnpm ui:review`

## Browser Flows

- Desktop 1440x900
  - signed in as a customer
  - searched and opened a product
  - added it to the cart
  - completed checkout
  - confirmed the order in order history
```

Record the date, mode, commands, viewports, ordered flow steps, findings, and anything not verified. “Verified checkout” is not reproducible.

## Gate

Frontend verification passes only when:

- no implementation stub remains;
- `pnpm plan` reports every requirement section delivered by a screen or recorded as an omission;
- every screen was driven in the interactive browser and appears in `packages/frontend/wiki/interactive-review.md`;
- every requirement journey has executed live, against a running backend;
- every requirement journey asserts the concrete effect its requirement names, and would fail if that behavior disappeared;
- every screen and required state was inspected;
- `test:e2e` and the required presentation suites pass on the current source;
- the live run was built with no mode, so its bundle carries the live SDK; and
- the verification record matches what ran.
