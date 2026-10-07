package evidence

import (
  "testing"
)

/**
 * Verifies the walkers answer an occupied root the same way.
 *
 * Repairing one artifact kind and leaving the others would leave a branch
 * asymmetry, so every branch has to move together. Markdown reaches the same predicate through
 * a loader rather than a claim-side pass, so its repair clause is what proves
 * the split is by artifact kind and not by call site.
 *
 *  1. Put a file where a Markdown reference's root is declared.
 *  2. Read the root diagnostic.
 *  3. Assert the Markdown repair clause names a replacement and its own sources.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph creates a plain file at `documents` beside the project and runs the graph rule with a Markdown reference whose root is `../documents`; the test requires diagnostics containing `could not read the markdown root '../documents', which resolves to '` and `replace that path with a directory and the markdown sources it should hold`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored: a root occupied by a file cannot be fixed by creating a directory, so the Markdown repair clause must ask for a replacement and name Markdown sources rather than the missing-directory advice; no string is derived from the resolver.
 * @evidence contracts/testing.md#distinguishing-cases Only the path-exists-but-is-a-file state for a Markdown reference root is covered; the missing-directory state and the TypeScript and Prisma repair clauses are owned by sibling entries, and the second assertion is what separates this clause from them.
 * @evidence contracts/testing.md#execution-ownership TestANonDirectoryAtAMarkdownRootAsksToBeReplaced is a Go unit entry in the native test process; runRootedGraph writes the workspace to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestANonDirectoryAtAMarkdownRootAsksToBeReplaced(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "documents":           "not a directory\n",
    "project/src/sale.ts": "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "could not read the markdown root '../documents', which resolves to '",
  )
  assertProblemContains(
    t,
    messages,
    "replace that path with a directory and the markdown sources it should hold",
  )
}
