package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a real Markdown walk failure reports the project-relative path.
 *
 * The unit cases above compose the message from a base a test built. This runs
 * the actual rule against a directory the process may not list, so the value the
 * walker hands the callback is the real one and the relevance guard above the
 * report is genuinely traversed.
 *
 *  1. Make a directory inside the configured globs unreadable.
 *  2. Run the rule.
 *  3. Assert the path the rule prints is project-relative.
 * @evidence contracts/testing.md#behavioral-verification The test makes docs/private unreadable (skipping where the platform or a root user cannot deny a listing), then runIndexRuleAtRoot runs the graph rule with a Markdown reference over docs/**\/*.md; it requires a diagnostic containing `could not inspect 'docs/private':`, no `matched no markdown files` diagnostic, and no diagnostic quoting the absolute private path.
 * @evidence contracts/testing.md#independent-expectations The expected spelling is the authored project-relative `docs/private`; the absolute path of the temp directory is known to the test from its own allocation, so its absence in the rule-authored quoted segment is checked against a value the rule did not produce. The operating-system cause after the quote may legitimately carry an absolute path and is not asserted.
 * @evidence contracts/testing.md#distinguishing-cases One failing directory beside a readable docs/public.md; the second assertion separates a walk failure that fails its population from an empty population, and the third separates a project-relative path from an absolute one. A declared root above the project is covered by a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestARealMarkdownWalkFailureNamesTheProjectRelativePath is a Go unit entry in the native test process; it drives the real graph rule over a real temp directory with permissions dropped, with no consumer install or product host, and skips where permissions cannot be dropped.
 */
func TestARealMarkdownWalkFailureNamesTheProjectRelativePath(t *testing.T) {
  root := t.TempDir()
  private := filepath.Join(root, "docs", "private")
  if err := os.MkdirAll(private, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(private, "hidden.md"), []byte("## Hidden\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, private)
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "docs/public.md": "## Public {#public}\n",
    "src/sale.ts":    "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "could not inspect 'docs/private':")
  if countProblemsContaining(messages, "matched no markdown files") != 0 {
    t.Fatalf(
      "an entry the walk could not read fails its population rather than emptying it:\n%s",
      strings.Join(messages, "\n"),
    )
  }
  // The quoted segment is the path this rule chose. The cause after it belongs
  // to the operating system and legitimately carries an absolute path, so the
  // absence is asserted where the rule is the author.
  if countProblemsContaining(messages, "'"+filepath.ToSlash(private)+"'") != 0 {
    t.Fatalf(
      "the path this rule prints is project-relative:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
