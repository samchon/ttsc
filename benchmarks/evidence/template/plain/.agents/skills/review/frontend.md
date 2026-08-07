# Frontend Review

Apply the Review skill's review loop until dry to every file, live state, journey, and relationship in the frontend scope.

## Scope

The complete frontend scope contains:

- every requirement under `docs/analysis/`;
- every authored and generated API contract under `packages/api/src/`;
- every frontend source file under `packages/frontend/src/`;
- every browser test under `packages/frontend/tests/`;
- every planning and verification record under `packages/frontend/wiki/`;
- every frontend configuration file that affects compilation, SDK use, Vite, Playwright, or runtime behavior; and
- every live screen, state, interaction, refusal, and user journey required by the specification.

## Requirement Propagation

Read every requirement in full. Treat each individual requirement as a root and independently follow every applicable branch.

1. Propagate the requirement into the API used by the frontend.
   - Identify every operation, actor, input, output, effect, refusal, error, pagination rule, ordering rule, and lifecycle state the interface must represent.
   - Verify that the current SDK exposes the exact contract the requirement needs.
2. Propagate the requirement into screens and interactions.
   - Verify that the user can discover and complete the whole behavior through the interface.
   - Verify loading, empty, success, error, refused, stale, retry, disabled, and responsive states wherever the requirement makes them possible.
   - Verify authorization, navigation, confirmation, form validation, optimistic updates, cache invalidation, and deletion consequences.
3. Propagate the requirement into browser tests and live journeys.
   - Verify every required actor, setup, action, visible result, refusal, recovery, and persistent consequence.
   - Verify that a live journey proves the actual backend and frontend behavior instead of a simulated substitute.
   - Verify that the journey would fail if the named requirement disappeared.

Complete all branches for one requirement before treating that requirement as reviewed. Similar screens or journeys never share credit.

## API Propagation

Read every operation and DTO in full. Treat each operation and property as a root.

1. Find every frontend consumer.
   - Verify the exact request construction, actor context, path parameter, query, body, and optional value.
   - Verify response decoding, null and empty meanings, errors, refusals, retries, and stale data behavior.
2. Follow every operation through state and presentation.
   - Verify cache keys, invalidation, optimistic state, pagination, sorting, filters, route transitions, and deletion cleanup.
   - Verify that all promised values and states become visible at the right time and to the right actor.
3. Follow every operation into browser tests.
   - Verify that tests use the real operation and assert the complete visible consequence.
   - Record unconsumed operations, invented client behavior, missing error handling, and unproved branches as findings.

## Operation Coverage Propagation

Every generated accessor states its own address in its JSDoc, so the operation list is exact rather than reconstructed. From the workspace root:

```bash
rg --no-filename -o '@accessor \S+' packages/api/src/functional | sort
```

This is a cross-check index, not a read. It does not shorten the literal full reading of `packages/api/src/`, and an accessor absent from the index but present in the source is itself a finding. Use it to guarantee the propagation below reaches every operation, and work it entry by entry.

1. Name, for each accessor, the hook under `src/lib/<domain>/hooks.ts` that calls it, and the screen that renders that hook.
   - An accessor no hook calls is a missing feature, not an implementation detail: a partially consumed operation set is a partially delivered product.
   - A hook no screen uses is the same omission one layer up — the call exists and the user still cannot reach it.
   - Record either as a finding and follow it to the screen the requirements say should surface it.
2. Verify the call is the hook's own.
   - Confirm no handwritten service or transport wrapper sits between the hook and the SDK.
   - Confirm a page fetches through the hook rather than calling the accessor itself.
3. Close the chain at the browser.
   - Name the journey that walks each screen. A screen no journey walks is unproven in the browser, and it leaves every accessor beneath it unproven too.
4. Verify the reverse direction.
   - An operation the frontend calls that no requirement asks for is over-implementation and a finding.
   - A screen that fabricates data an operation already returns is a finding.

A deliberate non-consumption is a finding until a requirement backs it. Record the requirement that makes the operation backend-only; an entry in `wiki/omissions.md` restates the decision but does not justify it.

## Frontend Source Propagation

Read every frontend source file in full. Treat each route, screen, component, state transition, interaction, and deliberate omission as a claim.

1. Trace it backward to the exact requirement and API contract that justify it.
2. Trace it forward to its complete live user journey and browser-test proof.
3. Verify accessibility, responsive behavior, focus, keyboard interaction, loading, empty, error, refused, retry, stale, and success states where applicable.
4. Record decorative substitutes, unreachable actions, stale caches, incomplete cleanup, hidden errors, invented restrictions, and unrequired exposure as findings.

Visual plausibility, compilation, a rendered screenshot, and a passing simulated test do not establish that a live user can complete the requirement.

## Configuration Closure

Every frontend configuration file is read in full like any other. Then compare it with the baseline commit; that comparison is an extra check, never a substitute for the read.

These files are the measurement boundary, not product work.

Any difference from the baseline is a finding regardless of what it unblocks: a lint rule relaxed, a script weakened, a compiler option loosened, a dependency changed. Report it and restore the file rather than building on it.

## Browser Test And Live Closure

Read every browser test in full and perform every required journey against the live application.

1. Trace each test backward to its requirement, API operation, screen, and actor.
2. Verify the complete setup, interaction, visible result, backend effect, refusal, recovery, and cleanup.
3. Verify real network behavior with simulation disabled where the instruction requires it.
4. Verify that assertions observe user-visible meaning rather than only element existence, URL changes, or mocked responses.
5. Record missing journeys and tests that preserve a frontend or backend defect as findings.
