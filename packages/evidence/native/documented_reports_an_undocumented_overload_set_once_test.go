package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the overload branch still fires when no signature is documented.
 *
 * Merging the run must not become skipping it, which would exempt every
 * overloaded callable in a project.
 *
 *  1. Leave every signature of an overload set undocumented.
 *  2. Run the rule.
 *  3. Assert exactly one finding for the set.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the overload branch still fires when no signature is documented. The original assertions check assert exactly one finding for the set.
 * @evidence contracts/testing.md#independent-expectations Merging the run must not become skipping it, which would exempt every overloaded callable in a project. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Leave every signature of an overload set undocumented. Run the rule. Assert exactly one finding for the set. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsAnUndocumentedOverloadSetOnce is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedReportsAnUndocumentedOverloadSetOnce(t *testing.T) {
  messages := runDocumentedRule(t, "src/format.ts", `
export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}
`, "")
  if len(messages) != 1 {
    t.Fatalf("expected one finding, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertReported(t, messages, "Missing JSDoc on exported function 'format'")
}
