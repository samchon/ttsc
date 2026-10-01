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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule twice with a TypeScript claim over src/**\/*.ts and a Markdown reference over docs/**\/*.md: with only docs/spec.md present (the claim matches no file) assertNoProblems requires an empty list; with only src/ref.ts present (the reference matches no file) the diagnostics must contain `reference 1` and `matched no markdown files`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the activation contract: a healthy claim with no selected host is inactive even when its glob matches nothing, while an active claim whose reference population is empty must diagnose that emptiness.
 * @evidence contracts/testing.md#distinguishing-cases The same configuration with the file that exists swapped: an empty claim population (silent) against an empty reference population under an active claim (reported).
 * @evidence contracts/testing.md#execution-ownership TestGlobEmptyClaimIsInactiveWhileEmptyReferenceReports is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
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
