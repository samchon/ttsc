package evidence

import (
  "errors"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a walk failure inside a linked population still names the declared
 * root.
 *
 * This is the one composition where the two paths a walk error touches come from
 * different places. A linked base is walked from the directory the link resolves
 * to, so the callback path is measured against that, while the spelling still
 * has to come from the base the author declared. Getting it the other way round
 * would print a directory that appears nowhere in the configuration, which is
 * the coupling a declared root exists to remove.
 *
 *  1. Declare a root and walk from a different directory, as a link does.
 *  2. Hand the decision a path under the directory actually walked.
 *  3. Assert the message names the declared root and not the walked one.
 *
 * @evidence contracts/testing.md#behavioral-verification unreadableEntryProblem is called with a base resolved for `../documents`, a walked directory `target` that differs from the declared root, an entry under it and a permission-denied cause; it must report the entry relevant and name `'../documents/requirements/private'`, and must not quote the walked directory in slash or native spelling.
 * @evidence contracts/testing.md#independent-expectations The expected spelling is authored: a reader opens the declared root, never the directory a link resolved to, so the walked path (computed by the test from its own workspace) must not appear as a quoted segment.
 * @evidence contracts/testing.md#distinguishing-cases A walk rooted away from the declared base, as a linked population is, against a relevance callback that accepts the relative entry; the negative checks cover both slash and native separators, since the historical leak printed the callback argument.
 * @evidence contracts/testing.md#execution-ownership TestAWalkFailureInsideALinkedPopulationNamesTheDeclaredRoot is a Go unit entry in the native test process; it calls unreadableEntryProblem directly with constructed paths and an in-memory cause, with no filesystem walk, consumer install or product host.
 */
func TestAWalkFailureInsideALinkedPopulationNamesTheDeclaredRoot(t *testing.T) {
  workspace := t.TempDir()
  base := resolvePopulationBase(filepath.Join(workspace, "project"), "../documents")
  from := filepath.Join(workspace, "target")
  problem, relevant := unreadableEntryProblem(
    base,
    from,
    "Markdown",
    filepath.Join(from, "requirements", "private"),
    errors.New("permission denied"),
    func(relative string) bool { return relative == "requirements/private" },
  )
  if !relevant {
    t.Fatal("a path the population reads is relevant however the walk reached it")
  }
  if !strings.Contains(problem, "'../documents/requirements/private'") {
    t.Fatalf("the path is spelled through the declared root, got: %s", problem)
  }
  // Only the quoted segment is this rule's, and in production the cause carries
  // the walked path in the operating system's own spelling, so the negative is
  // stated as the quoted forms the leak would take rather than by slicing the
  // message apart. Both spellings are named because the historical leak printed
  // the callback's own argument, which on Windows carries backslashes.
  leaked := filepath.Join(from, "requirements", "private")
  for _, spelling := range []string{filepath.ToSlash(leaked), leaked} {
    if strings.Contains(problem, "'"+spelling+"'") {
      t.Fatalf("the directory the link resolves to is not what a reader opens: %s", problem)
    }
  }
}
