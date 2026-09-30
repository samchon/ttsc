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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraphIn is exercised with the scenario below; the assertions require the root is named rather than the claim vanishing.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The claim side is the worse half. A reference at least prints something misleading, while a claim whose population came back healthy and empty deactivates without a word and takes its whole obligation with it, so the build goes green over code nobody is answering for.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Root a Markdown claim at a directory the process may not list, selecting with a segment-leading glob, which is the shape that produced the silence. Run the rule. Assert the root is named rather than the claim vanishing.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAnUnlistableClaimRootDoesNotDeactivateInSilence is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
