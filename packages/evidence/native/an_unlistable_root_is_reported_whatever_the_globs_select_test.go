package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies the report does not depend on the shape of the configured globs.
 *
 * `couldMatchDescendant(".")` is true for a pattern opening with `**` and false
 * for one opening with a segment, so before the repair an identical filesystem
 * state was reported under the first shape and swallowed under the second. The
 * base belongs to its population by construction, which is a fact about the
 * base and not about the patterns, so both selections have to answer alike.
 *
 *  1. Root one population with a leading `**` pattern and one with a segment.
 *  2. Make the root unlistable in both.
 *  3. Assert both name the root and neither derives a glob diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification For each of two reference patterns (`**\/*.md` and `requirements/**\/*.md`) the test makes the temp `documents` directory unreadable (skipping where permissions cannot be dropped) and runRootedGraphIn runs the graph rule with a Markdown reference rooted at `../documents`; every run must contain `could not walk Markdown root '../documents':` and none may contain `matched no markdown files`.
 * @evidence contracts/testing.md#independent-expectations The expected outcome is authored from the contract that a base belongs to its population regardless of glob shape, so an unlistable base must be named under both a leading `**` pattern and a segment-leading one.
 * @evidence contracts/testing.md#distinguishing-cases Two glob shapes over the same filesystem state, the pair that previously answered differently (reported versus swallowed); the loop runs both as plain iterations, not named subtests, and the test skips where permissions cannot be dropped.
 * @evidence contracts/testing.md#execution-ownership TestAnUnlistableRootIsReportedWhateverTheGlobsSelect is a Go unit entry in the native test process; runRootedGraphIn drives the graph rule over real temp workspaces with a permission-dropped directory, with no consumer install or product host.
 */
func TestAnUnlistableRootIsReportedWhateverTheGlobsSelect(t *testing.T) {
  for _, pattern := range []string{`"**/*.md"`, `"requirements/**/*.md"`} {
    workspace := t.TempDir()
    documents := filepath.Join(workspace, "documents")
    if err := os.MkdirAll(documents, 0o755); err != nil {
      t.Fatal(err)
    }
    unreadableDirectory(t, documents)
    messages := runRootedGraphIn(t, workspace, map[string]string{
      "project/src/sale.ts": "export interface ISale {}\n",
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/**/*.ts"],
      "symbol":"type",
      "reference":{
        "type":"markdown",
        "root":"../documents",
        "files":[`+pattern+`],
        "symbol":"h2"
      }
    }]}`)
    assertProblemContains(t, messages, "could not walk Markdown root '../documents':")
    if countProblemsContaining(messages, "matched no markdown files") != 0 {
      t.Fatalf(
        "pattern %s derived a glob diagnostic from a failed population:\n%s",
        pattern,
        strings.Join(messages, "\n"),
      )
    }
  }
}
