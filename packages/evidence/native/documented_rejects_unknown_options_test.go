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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies an unknown option is rejected rather than ignored. The original assertions check assert a configuration diagnostic instead of a scan.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A misspelled property that decodes to the zero value silently restores the default selection, so a project believing it narrowed the rule would be running the widest form. The decoder has to refuse it. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure a misspelled option key. Run the rule. Assert a configuration diagnostic instead of a scan. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedRejectsUnknownOptions is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedRejectsUnknownOptions(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbols":"type"}`)
  assertReported(t, messages, "unknown property")
}
