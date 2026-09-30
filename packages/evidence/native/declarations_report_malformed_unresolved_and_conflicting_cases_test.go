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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies declaration validation: malformed, unresolved, and conflicting acknowledgements receive distinct actionable diagnostics. The original assertions check assert each failure class is reported without losing coverage.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations These failures share one tag grammar but have different repairs. Collapsing them into "not covered" would hide whether the author must add a reason, correct a target, or remove a contradictory acknowledgement. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Add one valid declaration and three adjacent invalid declarations. Evaluate them against one configured source unit. Assert each failure class is reported without losing coverage. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDeclarationsReportMalformedUnresolvedAndConflictingCases is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
