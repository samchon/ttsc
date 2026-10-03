package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies an unlistable claim root does not deactivate the claim in silence.
 *
 * The claim side is the worse half. A reference at least prints something
 * misleading, while a claim whose population came back healthy and empty
 * deactivates without a word and takes its whole obligation with it, so the
 * build goes green over code nobody is answering for.
 *
 *  1. Root a Markdown claim at a directory the process may not list, selecting
 *     with a segment-leading glob, which is the shape that produced the silence.
 *  2. Run the rule.
 *  3. Assert the root is named rather than the claim vanishing.
 *
 * @evidence contracts/testing.md#behavioral-verification The test makes the temp `documents` directory unreadable (skipping where permissions cannot be dropped) and runRootedGraphIn runs the graph rule with a Markdown claim rooted at `../documents` selecting requirements/**\/*.md; exactly one message must contain `could not walk Markdown root '../documents':`.
 * @evidence contracts/testing.md#independent-expectations The expected count of one is authored: an unlistable claim base must be named rather than deactivating the claim silently, and the two walks of a claim base (activation and after) must collapse into one reported failure.
 * @evidence contracts/testing.md#distinguishing-cases A segment-leading glob over an unlistable claim root, the shape that previously produced a healthy empty population; zero messages (silence) and two messages (duplicate) would each fail the equality-to-one check.
 * @evidence contracts/testing.md#execution-ownership TestAnUnlistableClaimRootDoesNotDeactivateInSilence is a Go unit entry in the native test process; runRootedGraphIn drives the graph rule over a real temp workspace with a permission-dropped directory, with no consumer install or product host, and the test skips where permissions cannot be dropped.
 */
func TestAnUnlistableClaimRootDoesNotDeactivateInSilence(t *testing.T) {
  workspace := t.TempDir()
  documents := filepath.Join(workspace, "documents")
  if err := os.MkdirAll(documents, 0o755); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, documents)
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[{
    "type":"markdown",
    "root":"../documents",
    "files":["requirements/**/*.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h3"}
  }]}`)
  // A claim base is walked twice, once for activation and once after it, so this
  // also holds the deduplication that keeps one failure one message.
  if named := countProblemsContaining(messages, "could not walk Markdown root '../documents':"); named != 1 {
    t.Fatalf(
      "a claim base that could not be listed is named once, got %d:\n%s",
      named,
      strings.Join(messages, "\n"),
    )
  }
}
