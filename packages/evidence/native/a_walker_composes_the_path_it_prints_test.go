package evidence

import (
  "errors"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies the walker composes the path rather than printing the one it was
 * handed.
 *
 * This is the property the repair actually bought, and the unit case above
 * cannot prove it: reverting both walkers to print the callback's own argument
 * leaves every direct call to the message builder passing. The decision runs
 * here over a real OS-native absolute path, so a Windows lane covers it too,
 * where a genuine walk failure cannot be provoked at all.
 *
 *  1. Hand the decision an OS-native absolute path inside a declared root.
 *  2. Read the message it composes.
 *  3. Assert the population-relative spelling and no OS-native one.
 * @evidence contracts/testing.md#behavioral-verification unreadableEntryProblem is called with the resolved base for `../documents`, the base's own absolute directory as the walked root, an entry path built under it with filepath.Join and a callback accepting `requirements/private`; it must be relevant, quote `'../documents/requirements/private'`, and not contain the entry's slash-separated absolute path.
 * @evidence contracts/testing.md#independent-expectations The expected spelling is authored; the absolute entry path is built by the test from the platform's own separators, so it also runs on Windows where a real walk failure cannot be provoked, and its absence shows the callback argument was not printed as received.
 * @evidence contracts/testing.md#distinguishing-cases One relevant entry under an ascending declared root; the unrelated-entry silent case and the linked-walk case are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAWalkerComposesThePathItPrints is a Go unit entry in the native test process; it calls unreadableEntryProblem on constructed OS-native paths with no filesystem walk, consumer install or product host.
 */
func TestAWalkerComposesThePathItPrints(t *testing.T) {
  workspace := t.TempDir()
  base := resolvePopulationBase(filepath.Join(workspace, "project"), "../documents")
  current := filepath.Join(base.Absolute, "requirements", "private")
  problem, relevant := unreadableEntryProblem(
    base,
    base.Absolute,
    "Markdown",
    current,
    errors.New("permission denied"),
    func(relative string) bool { return relative == "requirements/private" },
  )
  if !relevant {
    t.Fatal("a path the population reads is relevant")
  }
  if !strings.Contains(problem, "'../documents/requirements/private'") {
    t.Fatalf("the path is composed through the base, got: %s", problem)
  }
  if strings.Contains(problem, filepath.ToSlash(current)) {
    t.Fatalf("the callback's own argument is not what a reader opens: %s", problem)
  }
}
