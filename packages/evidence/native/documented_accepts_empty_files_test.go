package evidence

import "testing"

/**
 * Verifies an empty file is silent.
 *
 * The zero case: no statements means no host, and a walker assuming at least
 * one would fault on the emptiest input a project can contain.
 *
 *  1. Parse a file with no statements.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies an empty file is silent. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The zero case: no statements means no host, and a walker assuming at least one would fault on the emptiest input a project can contain. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Parse a file with no statements. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedAcceptsEmptyFiles is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedAcceptsEmptyFiles(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/blank.ts", "", ""))
}
