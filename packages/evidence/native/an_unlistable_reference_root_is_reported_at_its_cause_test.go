package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies an unlistable reference root is reported instead of being blamed on
 * the globs.
 *
 * The failure guard answered for entries inside the base, and answered for the
 * base itself only by accident: its base-relative path is `.`, which the glob
 * shape decides. Under this reference's `requirements/**` it is false, so the
 * one failure that empties the whole population was discarded, the population
 * reached evaluation healthy and empty, and the author was told their patterns
 * matched nothing.
 *
 *  1. Root a Markdown reference at a directory the process may not list.
 *  2. Run the rule.
 *  3. Assert the root is named and no glob diagnostic is derived from it.
 *
 * @evidence contracts/testing.md#behavioral-verification The test makes the temp `documents` directory (holding requirements/pricing.md) unreadable, skipping where permissions cannot be dropped, and runRootedGraphIn runs the graph rule with a Markdown reference rooted at `../documents` over requirements/**\/*.md; exactly one message must contain `could not walk Markdown root '../documents':` and none may contain `matched no markdown files` or `could not inspect`.
 * @evidence contracts/testing.md#independent-expectations The expected outputs are authored: the single failure that empties the whole population must be named at the root, not blamed on the globs and not repeated as an entry failure.
 * @evidence contracts/testing.md#distinguishing-cases A reference glob that starts at a segment (`requirements/**`) over an unlistable root, the shape for which the base-relative `.` path was previously discarded; count-one plus the two absent derived messages separate silence, duplication and a misattributed glob diagnostic.
 * @evidence contracts/testing.md#execution-ownership TestAnUnlistableReferenceRootIsReportedAtItsCause is a Go unit entry in the native test process; runRootedGraphIn drives the graph rule over a real temp workspace with a permission-dropped directory, with no consumer install or product host, and the test skips where permissions cannot be dropped.
 */
func TestAnUnlistableReferenceRootIsReportedAtItsCause(t *testing.T) {
  workspace := t.TempDir()
  documents := filepath.Join(workspace, "documents")
  if err := os.MkdirAll(filepath.Join(documents, "requirements"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(documents, "requirements", "pricing.md"),
    []byte("## Discounts {#discounts}\n"),
    0o644,
  ); err != nil {
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
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  if named := countProblemsContaining(messages, "could not walk Markdown root '../documents':"); named != 1 {
    t.Fatalf(
      "a base that could not be listed is named once, got %d:\n%s",
      named,
      strings.Join(messages, "\n"),
    )
  }
  for _, derived := range []string{"matched no markdown files", "could not inspect"} {
    if countProblemsContaining(messages, derived) != 0 {
      t.Fatalf(
        "a base that could not be listed is reported once, at its cause:\n%s",
        strings.Join(messages, "\n"),
      )
    }
  }
}
