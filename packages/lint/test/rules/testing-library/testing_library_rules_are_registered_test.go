package linthost

import "testing"

/**
 * Verifies testing-library rule family: registers every upstream core rule id.
 *
 * Locks the public rule-name surface before the behavioral cases exercise a
 * smaller representative slice. A missing registration would make a user config
 * silently fall into the engine's unknown-rule path instead of linting tests.
 *
 * 1. List the 29 eslint-plugin-testing-library rule names targeted by this port.
 * 2. Look up each `testing-library/*` id in the native registry.
 * 3. Assert every rule is present.
 */
//
// @evidence contracts/testing.md#behavioral-verification LookupRule must resolve each of the 29 supported testing-library identifiers, detecting a missing public runtime registration.
// @evidence contracts/testing.md#independent-expectations These literals name the public supported rule surface; runtime registry lookup checks resolution, not committed file existence.
// @evidence contracts/testing.md#distinguishing-cases Each configured rule must resolve; actual rule behavior is owned by the individual source cases, so this lookup is not semantic equivalence proof.
// @evidence contracts/testing.md#execution-ownership TestTestingLibraryRulesAreRegistered owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
func TestTestingLibraryRulesAreRegistered(t *testing.T) {
  names := []string{
    "await-async-events",
    "await-async-queries",
    "await-async-utils",
    "consistent-data-testid",
    "no-await-sync-events",
    "no-await-sync-queries",
    "no-container",
    "no-debugging-utils",
    "no-dom-import",
    "no-global-regexp-flag-in-query",
    "no-manual-cleanup",
    "no-node-access",
    "no-promise-in-fire-event",
    "no-render-in-lifecycle",
    "no-test-id-queries",
    "no-unnecessary-act",
    "no-wait-for-multiple-assertions",
    "no-wait-for-side-effects",
    "no-wait-for-snapshot",
    "prefer-explicit-assert",
    "prefer-find-by",
    "prefer-implicit-assert",
    "prefer-presence-queries",
    "prefer-query-by-disappearance",
    "prefer-query-matchers",
    "prefer-screen-queries",
    "prefer-user-event",
    "prefer-user-event-setup",
    "render-result-naming-convention",
  }
  for _, name := range names {
    if LookupRule("testing-library/"+name) == nil {
      t.Fatalf("missing testing-library/%s", name)
    }
  }
}
