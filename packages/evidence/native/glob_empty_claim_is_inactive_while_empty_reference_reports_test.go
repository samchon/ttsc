package evidence

import (
  "testing"
)

/**
 * Verifies empty glob matches respect claim activation and reference health.
 *
 * A healthy claim with no selected host is inactive, including when its glob
 * matches no file. An active claim's empty reference is different: the host
 * exists and its configured proof population must therefore diagnose emptiness.
 *
 *  1. Point one claim glob at no TypeScript file and require silence.
 *  2. Activate its twin with one selected export and match no reference file.
 *  3. Assert only the active claim reports its empty reference population.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule is exercised with the scenario below; the assertions require only the active claim reports its empty reference population.
 * @evidence contracts/testing.md#independent-expectations A healthy claim with no selected host is inactive, including when its glob matches no file. An active claim's empty reference is different: the host exists and its configured proof population must therefore diagnose emptiness.
 * @evidence contracts/testing.md#distinguishing-cases Point one claim glob at no TypeScript file and require silence. Activate its twin with one selected export and match no reference file. Assert only the active claim reports its empty reference population.
 * @evidence contracts/testing.md#execution-ownership TestGlobEmptyClaimIsInactiveWhileEmptyReferenceReports is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestGlobEmptyClaimIsInactiveWhileEmptyReferenceReports(t *testing.T) {
  claimMessages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Spec",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, claimMessages)

  referenceMessages := runIndexRule(t, map[string]string{
    "src/ref.ts": "export interface Ref {}",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, referenceMessages, "reference 1")
  assertProblemContains(t, referenceMessages, "matched no markdown files")
}
