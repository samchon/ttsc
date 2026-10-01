package evidence

import "testing"

/**
 * Verifies an unknown option is rejected rather than ignored.
 *
 * A misspelled property that decodes to the zero value silently restores the
 * default selection, so a project believing it narrowed the rule would be
 * running the widest form. The decoder has to refuse it.
 *
 *  1. Configure a misspelled option key.
 *  2. Run the rule.
 *  3. Assert a configuration diagnostic instead of a scan.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule over an undocumented `parse` function with the misspelled option key `{"symbols":"type"}`; assertReported requires exactly one diagnostic, containing `unknown property`.
 * @evidence contracts/testing.md#independent-expectations The expected outcome is authored from the option contract: an unknown property must be refused rather than decoded to the zero value, which would silently restore the default population; the exactly-one result also shows the undocumented export was not scanned.
 * @evidence contracts/testing.md#distinguishing-cases One misspelled key; the unsupported-symbol-value branch and the graph-name attribution are covered by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedRejectsUnknownOptions is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedRejectsUnknownOptions(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbols":"type"}`)
  assertReported(t, messages, "unknown property")
}
