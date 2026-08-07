# Frontend Verification

Compilation cannot prove that a control works, a journey completes, or the layout remains usable. Browser execution is part of completion.

## Programs

```text
packages/frontend/tests/
  journeys/            one spec per requirement-backed journey
  ui-review.spec.ts    production layout and interaction review
  readme.spec.ts       documentation screenshots
```

The package scripts build the production bundle before Playwright:

```bash
pnpm test:e2e
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

Run the same journey suite twice:

1. with `VITE_API_SIMULATE=true` for typed client flow; and
2. with `VITE_API_SIMULATE=false` against backend `pnpm dev` for persistence, sessions, authorization, and side effects.

Generated simulation data is random and does not reliably produce empty, refusal, boundary, or long-content states. Inspect those through deterministic fixtures.

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

Drive every main journey in an interactive browser. Verify:

- each control causes its promised observable change;
- search, sort, pagination, page size, toggles, dialogs, and forms work;
- expected refusals are actionable;
- session and actor changes do not leak cached data;
- the layout works at required widths; and
- copy and values match the contract.

Turn every discovered defect into a stable browser assertion. When interactive browser control is unavailable, record the exact fallback and unverified boundary.

## Record

Keep `packages/frontend/wiki/verification.md` current:

```markdown
## Environment

- Production frontend build
- Backend running at the configured API host
- `VITE_API_SIMULATE=false`

## Automated

- `pnpm test:e2e`
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
- every requirement journey has executed in simulation and live mode;
- every screen and required state was inspected;
- `test:e2e` and required presentation suites pass on the current source;
- the live backend integration actually used `VITE_API_SIMULATE=false`; and
- the verification record matches what ran.
