package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a root written with backslashes is named in one slash-separated
 * form.
 *
 * An author on Windows may write `..\contracts`, and the message asking them to
 * correct it sits beside file locations this rule always prints with slashes.
 * The normalization belongs to the decoder, which runs before a project identity
 * exists to resolve against; this pins the composition end to end, because
 * storing the declared spelling is what makes the decoder's output visible to a
 * reader at all.
 *
 *  1. Declare the root with backslashes.
 *  2. Read the root diagnostic.
 *  3. Assert it names the slash-separated spelling and carries no backslash.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph runs the graph rule with a TypeScript claim whose root is written `..\contracts` (a missing directory); the test requires a diagnostic containing `the typescript root '../contracts'` and that no message contains `\contracts`.
 * @evidence contracts/testing.md#independent-expectations The expected spelling is the authored slash-separated form of the same path, following the contract that diagnostics print paths with slashes; the check is on the message text, not a value recomputed by the decoder.
 * @evidence contracts/testing.md#distinguishing-cases One backslash-written root against its slash spelling in the message; the loop over all messages guards against any other diagnostic leaking the backslash form. A root already written with slashes is covered by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestARootWrittenWithBackslashesIsNamedWithSlashes is a Go unit entry in the native test process; runRootedGraph writes the fixture to a temp workspace and calls the graph rule directly, with no consumer install or product host.
 */
func TestARootWrittenWithBackslashesIsNamedWithSlashes(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"..\\contracts",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "the typescript root '../contracts'")
  for _, message := range messages {
    if strings.Contains(message, "\\contracts") {
      t.Fatalf("a declared root is named with slashes, got:\n%s", message)
    }
  }
}
