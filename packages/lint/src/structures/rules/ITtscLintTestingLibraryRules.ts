import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";
import type { ITtscLintTestingLibraryConsistentDataTestIdRuleOptions } from "./ITtscLintTestingLibraryRuleOptions";

/**
 * Testing Library test source rules from `eslint-plugin-testing-library`.
 *
 * Apply to TypeScript test sources that use any `@testing-library/*` package
 * and detect Testing Library anti-patterns — `container` access, `ByTestId`
 * overuse, missing `await` on async queries.
 *
 * @reference https://github.com/testing-library/eslint-plugin-testing-library
 */
export interface ITtscLintTestingLibraryRules {
  /**
   * Require awaiting async user-event methods (`userEvent.click`,
   * `userEvent.type`, ...) under the v14+ Promise-returning API.
   *
   * Without `await` the next assertion runs against the pre-interaction DOM,
   * which masks effects the user action was meant to trigger.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/await-async-events.md
   */
  "testing-library/await-async-events"?: TtscLintRuleSetting;

  /**
   * Require awaiting `findBy*` and `findAllBy*` queries.
   *
   * They return a Promise that resolves once the element appears; an unawaited
   * query yields a pending Promise that no matcher can assert against
   * meaningfully.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/await-async-queries.md
   */
  "testing-library/await-async-queries"?: TtscLintRuleSetting;

  /**
   * Require awaiting `waitFor`, `waitForElementToBeRemoved`, and the other
   * async Testing Library utilities.
   *
   * Skipping the `await` means the test moves on before the predicate settles,
   * so subsequent assertions race against the wait.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/await-async-utils.md
   */
  "testing-library/await-async-utils"?: TtscLintRuleSetting;

  /**
   * Validate JSX `data-testid` attribute values against a regex pattern.
   *
   * The options object names the attribute and the pattern, keeping test ids
   * consistently formed across components.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/consistent-data-testid.md
   */
  "testing-library/consistent-data-testid"?: TtscLintRuleOptionsSetting<ITtscLintTestingLibraryConsistentDataTestIdRuleOptions>;

  /**
   * Reject unnecessary `await` before synchronous event helpers
   * (`fireEvent.click(...)`).
   *
   * The helpers return `boolean` rather than a Promise, so the `await` is a
   * no-op that misleads readers into thinking the helper is async.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-await-sync-events.md
   */
  "testing-library/no-await-sync-events"?: TtscLintRuleSetting;

  /**
   * Reject unnecessary `await` before synchronous queries (`getBy*`,
   * `queryBy*`).
   *
   * These queries return DOM nodes directly, so the `await` misleads readers
   * and can shadow a genuine missing `await` on an adjacent `findBy*`.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-await-sync-queries.md
   */
  "testing-library/no-await-sync-queries"?: TtscLintRuleSetting;

  /**
   * Reject `container` destructuring and DOM query methods on the render
   * result.
   *
   * `screen` queries the same document but matches how the user sees the page,
   * keeping tests accessibility-first and resilient to layout refactors that
   * move nodes inside the tree.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-container.md
   */
  "testing-library/no-container"?: TtscLintRuleSetting;

  /**
   * Reject `debug`, `prettyDOM`, `logTestingPlaygroundURL`, and related
   * debugging utilities in committed tests.
   *
   * They print large DOM dumps to CI logs and only exist to help during local
   * authoring.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-debugging-utils.md
   */
  "testing-library/no-debugging-utils"?: TtscLintRuleSetting;

  /**
   * Reject direct `@testing-library/dom` imports when a framework-specific
   * package is installed.
   *
   * Framework packages (`@testing-library/react`, ...) re-export the same
   * surface plus a `render` that wires the framework's lifecycle — importing
   * `dom` directly skips that wiring.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-dom-import.md
   */
  "testing-library/no-dom-import"?: TtscLintRuleSetting;

  /**
   * Reject global RegExp flags (`/foo/g`) inside query text matchers.
   *
   * The matcher reuses the regex across nodes, so a global regex's persistent
   * `lastIndex` state causes the second call to skip matches the first one
   * found.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-global-regexp-flag-in-query.md
   */
  "testing-library/no-global-regexp-flag-in-query"?: TtscLintRuleSetting;

  /**
   * Reject manual `cleanup()` calls.
   *
   * Framework wrappers (`@testing-library/react`, ...) register automatic
   * cleanup, so explicit calls duplicate the unmount and can race against the
   * runner's between-test reset.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-manual-cleanup.md
   */
  "testing-library/no-manual-cleanup"?: TtscLintRuleSetting;

  /**
   * Reject direct DOM node traversal from query results (`.parentElement`,
   * `.firstChild`, `.children`, ...).
   *
   * Traversal couples the test to incidental markup; another semantic query
   * names what the assertion actually cares about.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-node-access.md
   */
  "testing-library/no-node-access"?: TtscLintRuleSetting;

  /**
   * Reject Promise-producing expressions passed to `fireEvent`, since
   * `fireEvent` is synchronous and the Promise is dropped.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-promise-in-fire-event.md
   */
  "testing-library/no-promise-in-fire-event"?: TtscLintRuleSetting;

  /**
   * Reject `render(...)` inside lifecycle hooks (`beforeEach`, etc.).
   *
   * Each test should render its component directly so the arrange step is
   * visible in-place and auto-cleanup runs between cases without sharing
   * state.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-render-in-lifecycle.md
   */
  "testing-library/no-render-in-lifecycle"?: TtscLintRuleSetting;

  /**
   * Reject `*ByTestId` queries.
   *
   * Test ids couple the test to incidental markup and skip the accessibility
   * tree that real users navigate; queries by role, label, or text describe the
   * UI in user-visible terms instead.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-test-id-queries.md
   */
  "testing-library/no-test-id-queries"?: TtscLintRuleSetting;

  /**
   * Reject unnecessary `act(...)` wrappers around Testing Library helpers.
   *
   * `render`, `fireEvent`, and `userEvent` already wrap their work in `act`, so
   * the extra wrapper is dead code that obscures the real state change.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-unnecessary-act.md
   */
  "testing-library/no-unnecessary-act"?: TtscLintRuleSetting;

  /**
   * Reject multiple assertions inside one `waitFor` callback — split into
   * separate `waitFor`s so each retry boundary is narrow.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-wait-for-multiple-assertions.md
   */
  "testing-library/no-wait-for-multiple-assertions"?: TtscLintRuleSetting;

  /**
   * Reject side effects inside `waitFor` callbacks — `waitFor` retries the
   * callback, so side effects fire repeatedly.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-wait-for-side-effects.md
   */
  "testing-library/no-wait-for-side-effects"?: TtscLintRuleSetting;

  /**
   * Reject snapshot assertions inside `waitFor`.
   *
   * `waitFor` retries until the callback stops throwing, so the captured
   * snapshot is whichever pass happened to match — usually an intermediate
   * render rather than the settled UI the test cares about.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-wait-for-snapshot.md
   */
  "testing-library/no-wait-for-snapshot"?: TtscLintRuleSetting;

  /**
   * Require explicit assertions on the result of standalone queries.
   *
   * A bare `screen.getByRole(...)` looks like an assertion but only checks
   * presence (and only for `getBy*`); adding `expect(...)` makes the intent and
   * the matched property obvious.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-explicit-assert.md
   */
  "testing-library/prefer-explicit-assert"?: TtscLintRuleSetting;

  /**
   * Prefer `findBy*` over `waitFor` wrapping a `getBy*`.
   *
   * `findBy*` is the dedicated retry-aware query; the manual combination
   * duplicates its semantics and is easy to misconfigure (wrong timeout,
   * missing `await`).
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-find-by.md
   */
  "testing-library/prefer-find-by"?: TtscLintRuleSetting;

  /**
   * Avoid redundant `toBeInTheDocument()` around `getBy*` queries.
   *
   * `getBy*` already throws when nothing is found, so the extra matcher only
   * restates what the query promises and adds noise to the failure trace.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-implicit-assert.md
   */
  "testing-library/prefer-implicit-assert"?: TtscLintRuleSetting;

  /**
   * Match presence and absence assertions to the query variant that already
   * encodes the same semantic: `getBy*` for presence (throws when missing),
   * `queryBy*` for absence (returns `null` when missing). Mixing the two yields
   * confusing failure modes.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-presence-queries.md
   */
  "testing-library/prefer-presence-queries"?: TtscLintRuleSetting;

  /**
   * Prefer `queryBy*` inside disappearance waits.
   *
   * `waitFor` retries the callback against the disappearing element, but
   * `getBy*` throws on the very state being waited for, which produces a noisy
   * error in the trace each retry.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-query-by-disappearance.md
   */
  "testing-library/prefer-query-by-disappearance"?: TtscLintRuleSetting;

  /**
   * Prefer jest-dom document matchers (`toBeVisible`, `toHaveTextContent`, ...)
   * over generic equality checks on Testing Library queries.
   *
   * The dedicated matchers explain failures in terms of the DOM property they
   * assert on, not a structural diff of nodes.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-query-matchers.md
   */
  "testing-library/prefer-query-matchers"?: TtscLintRuleSetting;

  /**
   * Prefer `screen.*` over queries on the render-result object.
   *
   * `screen` is the single global query target, so tests stay consistent
   * regardless of which component is mounted and the render call's return value
   * rarely needs destructuring.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-screen-queries.md
   */
  "testing-library/prefer-screen-queries"?: TtscLintRuleSetting;

  /**
   * Prefer `userEvent` over `fireEvent`.
   *
   * `userEvent` simulates the full sequence of DOM events a real user triggers
   * (focus, keydown, input, change, ...) while `fireEvent` dispatches a single
   * event and skips intermediate state.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-user-event.md
   */
  "testing-library/prefer-user-event"?: TtscLintRuleSetting;

  /**
   * Prefer `userEvent.setup()` (the v14+ instance pattern) over the static
   * `userEvent.*` calls.
   *
   * The instance binds fresh pointer state per test, removing the cross-test
   * focus and click bookkeeping that the static API leaks.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/prefer-user-event-setup.md
   */
  "testing-library/prefer-user-event-setup"?: TtscLintRuleSetting;

  /**
   * Require the variable assigned from `render(...)` to use one of the
   * conventional names (`view`, `result`, ...).
   *
   * The name is a reading cue: a non-conventional one usually signals that the
   * destructured queries are being treated as a component surface instead of a
   * render artifact.
   *
   * @reference https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/render-result-naming-convention.md
   */
  "testing-library/render-result-naming-convention"?: TtscLintRuleSetting;
}
