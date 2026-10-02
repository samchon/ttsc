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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a Markdown claim over docs/spec.md (symbol file) and a TypeScript function reference over src/api/**, where the document cites the bare token `get`; the diagnostics must contain `Code evidence target 'get'`, `@link` and `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the addressing contract: file-qualified links enable this population without restoring repository-wide name lookup, so an unqualified symbol from a Markdown claim stays an error that names the `@link` repair and leaves the operation owed.
 * @evidence contracts/testing.md#distinguishing-cases A bare code symbol cited from Markdown; the file-qualified and inline forms that resolve are owned by the file-link entries.
 * @evidence contracts/testing.md#execution-ownership TestGraphRefusesCodeEvidenceToAClaimThatCannotAddressIt is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
