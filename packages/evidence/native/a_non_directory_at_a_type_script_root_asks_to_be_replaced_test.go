package evidence

import (
  "testing"
)

/**
 * Verifies a path a non-directory occupies asks to be replaced rather than
 * added.
 *
 * The stat this predicate runs fails on three states, and only two of them are
 * repaired by creating the directory. Told to "add that directory" over a path a
 * file already holds, an author follows the instruction, watches it fail, and
 * reads the same sentence again; the repair has to name what is in the way.
 *
 *  1. Put a file where a TypeScript claim's root is declared.
 *  2. Read the root diagnostic.
 *  3. Assert it states what is there and asks for a replacement.
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph is exercised with the scenario below; the assertions require it states what is there and asks for a replacement.
 * @evidence contracts/testing.md#independent-expectations The stat this predicate runs fails on three states, and only two of them are repaired by creating the directory. Told to "add that directory" over a path a file already holds, an author follows the instruction, watches it fail, and reads the same sentence again; the repair has to name what is in the way.
 * @evidence contracts/testing.md#distinguishing-cases Put a file where a TypeScript claim's root is declared. Read the root diagnostic. Assert it states what is there and asks for a replacement.
 * @evidence contracts/testing.md#execution-ownership TestANonDirectoryAtATypeScriptRootAsksToBeReplaced is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestANonDirectoryAtATypeScriptRootAsksToBeReplaced(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "contracts":               "not a directory\n",
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../contracts",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "because that path is not a directory")
  assertProblemContains(
    t,
    messages,
    "replace that path with a directory and make its sources part of the tsconfig Program",
  )
}
