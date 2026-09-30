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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph is exercised with the scenario below; the assertions require it names the slash-separated spelling and carries no backslash.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations An author on Windows may write `..\contracts`, and the message asking them to correct it sits beside file locations this rule always prints with slashes. The normalization belongs to the decoder, which runs before a project identity exists to resolve against; this pins the composition end to end, because storing the declared spelling is what makes the decoder's output visible to a reader at all.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare the root with backslashes. Read the root diagnostic. Assert it names the slash-separated spelling and carries no backslash.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestARootWrittenWithBackslashesIsNamedWithSlashes is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
