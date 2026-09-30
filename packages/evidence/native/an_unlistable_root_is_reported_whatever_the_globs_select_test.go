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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraphIn is exercised with the scenario below; the assertions require both name the root and neither derives a glob diagnostic.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `couldMatchDescendant(".")` is true for a pattern opening with `**` and false for one opening with a segment, so before the repair an identical filesystem state was reported under the first shape and swallowed under the second. The base belongs to its population by construction, which is a fact about the base and not about the patterns, so both selections have to answer alike.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Root one population with a leading `**` pattern and one with a segment. Make the root unlistable in both. Assert both name the root and neither derives a glob diagnostic.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAnUnlistableRootIsReportedWhateverTheGlobsSelect is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
