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
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph creates a plain file at `contracts` beside the project and runs the graph rule with a TypeScript claim whose root is `../contracts`; the test requires diagnostics containing `because that path is not a directory` and `replace that path with a directory and make its sources part of the tsconfig Program`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored: a root occupied by a file must be told to be replaced and to hold sources in the tsconfig Program, not told to add a directory that already exists as a file.
 * @evidence contracts/testing.md#distinguishing-cases Only the file-where-a-claim-root-is-declared state for a TypeScript claim is covered; the Markdown root clause and the missing-directory state belong to sibling entries, and the second assertion names the TypeScript-specific sources clause.
 * @evidence contracts/testing.md#execution-ownership TestANonDirectoryAtATypeScriptRootAsksToBeReplaced is a Go unit entry in the native test process; runRootedGraph writes the workspace to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
