package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies declaration validation: malformed, unresolved, and conflicting
 * acknowledgements receive distinct actionable diagnostics.
 *
 * These failures share one tag grammar but have different repairs. Collapsing
 * them into "not covered" would hide whether the author must add a reason,
 * correct a target, or remove a contradictory acknowledgement.
 *
 *  1. Add one valid declaration and three adjacent invalid declarations.
 *  2. Evaluate them against one configured source unit.
 *  3. Assert each failure class is reported without losing coverage.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over four interface declarations in one file (a valid `@evidence ...#contract` citation, one with no reason, one citing `docs/spec.md#unknown`, and an `@evidenceExclude` of the same section) against a type claim and a one-heading Markdown reference; the test requires `Malformed @evidence declaration` followed by the `Write '@evidence <target> <reason>'.` repair plus untrueTagWarning, `Unresolved evidence target 'docs/spec.md#unknown'`, `Conflicting acknowledgements for 'docs/spec.md#contract'`, no leaked `+untrueTagWarning` text and no `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expected fragments are authored from the diagnostic contract that malformed, unresolved and conflicting declarations each have their own repair; the unit being covered by the valid citation makes any missing-acknowledgement message a regression.
 * @evidence contracts/testing.md#distinguishing-cases Three adjacent invalid forms beside one valid declaration, each asserted by containment of its own fragment; the leaked-constant check pins that the warning is joined outside the quoted literal. The assertions do not pair each diagnostic with its source line.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationsReportMalformedUnresolvedAndConflictingCases is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestDeclarationsReportMalformedUnresolvedAndConflictingCases(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs/spec.md#contract Primary acknowledgement. */
export interface Primary {}

/** @evidence docs/spec.md#contract */
export interface MissingReason {}

/** @evidence docs/spec.md#unknown This target does not exist. */
export interface Unknown {}

/** @evidenceExclude docs/spec.md#contract This contradicts the implementation acknowledgement. */
export interface Conflict {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Malformed @evidence declaration")
  // The warning is a constant appended outside the literal, and asserting the
  // joint through the constant itself is what catches its name slipping
  // inside the quotes — where the message leaked '.+untrueTagWarning' and
  // dropped the warning from the one diagnostic class most likely to be
  // repaired by writing a hasty tag.
  assertProblemContains(t, messages, "Write '@evidence <target> <reason>'."+untrueTagWarning)
  if strings.Contains(strings.Join(messages, "\n"), "+untrueTagWarning") {
    t.Fatalf("a diagnostic leaked a constant's name:\n%s", strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Unresolved evidence target 'docs/spec.md#unknown'")
  assertProblemContains(t, messages, "Conflicting acknowledgements for 'docs/spec.md#contract'")
  if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
    t.Fatalf("the valid primary declaration did not cover the unit:\n%s", strings.Join(messages, "\n"))
  }
}
