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
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `format` written as two undocumented overload signatures and an implementation; the test requires exactly one message, containing `Missing JSDoc on exported function 'format'`.
 * @evidence contracts/testing.md#independent-expectations The expected count is authored from the identity contract: an overload run is one identity, so it is reported once rather than per signature, and merging the run must not become skipping it.
 * @evidence contracts/testing.md#distinguishing-cases A three-declaration overload set with no blocks: reporting each node would give three messages and skipping the set would give none.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsAnUndocumentedOverloadSetOnce is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
