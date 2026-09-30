package evidence

import (
  "testing"
)

/**
 * Verifies the walkers answer an occupied root the same way.
 *
 * Repairing one artifact kind and leaving the others is the branch asymmetry
 * #1236 existed to remove, and this clause was deferred once precisely because
 * every branch had to move together. Markdown reaches the same predicate through
 * a loader rather than a claim-side pass, so its repair clause is what proves
 * the split is by artifact kind and not by call site.
 *
 *  1. Put a file where a Markdown reference's root is declared.
 *  2. Read the root diagnostic.
 *  3. Assert the Markdown repair clause names a replacement and its own sources.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph is exercised with the scenario below; the assertions require the Markdown repair clause names a replacement and its own sources.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Repairing one artifact kind and leaving the others is the branch asymmetry #1236 existed to remove, and this clause was deferred once precisely because every branch had to move together. Markdown reaches the same predicate through a loader rather than a claim-side pass, so its repair clause is what proves the split is by artifact kind and not by call site.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Put a file where a Markdown reference's root is declared. Read the root diagnostic. Assert the Markdown repair clause names a replacement and its own sources.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestANonDirectoryAtAMarkdownRootAsksToBeReplaced is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
