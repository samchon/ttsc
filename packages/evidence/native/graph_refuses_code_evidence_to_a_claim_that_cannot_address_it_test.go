package evidence

import "testing"

/**
 * Verifies a bare symbol in Markdown still cannot identify a code module.
 *
 * File-qualified links enable this population without restoring the old
 * repository-wide name lookup. An unqualified symbol remains an error.
 *
 *  1. Configure a Markdown claim over a TypeScript reference.
 *  2. Evaluate the graph.
 *  3. Assert the bare citation is rejected and the file-qualified repair named.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a bare symbol in Markdown still cannot identify a code module. The original assertions check assert the bare citation is rejected and the file-qualified repair named.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations File-qualified links enable this population without restoring the old repository-wide name lookup. An unqualified symbol remains an error. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure a Markdown claim over a TypeScript reference. Evaluate the graph. Assert the bare citation is rejected and the file-qualified repair named. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphRefusesCodeEvidenceToAClaimThatCannotAddressIt is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphRefusesCodeEvidenceToAClaimThatCannotAddressIt(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "docs/spec.md":         "<!-- @evidence get Documents this operation. -->\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/spec.md"],
    "symbol":"file",
    "reference":{"type":"typescript","files":["src/api/**"],"symbol":"function"}
  }]}`)
  assertProblemContains(t, messages, "Code evidence target 'get'")
  assertProblemContains(t, messages, "@link")
  assertProblemContains(t, messages, "Missing acknowledgement")
}
