package evidence

import (
  "errors"
  "path/filepath"
  "testing"
)

/**
 * Verifies a path outside the configured population stays silent.
 *
 * The negative twin. A permission this population never needed is not its
 * finding, and reporting it would turn an unrelated directory beside the
 * documents into a build error. The relevance guard has to hold for an entry
 * under a declared root as well.
 *
 *  1. Hand the decision a path the population does not read.
 *  2. Read what it returns.
 *  3. Assert it reports nothing.
 * @evidence contracts/testing.md#behavioral-verification unreadableEntryProblem is called with a base for `../documents`, an entry `assets/private` under that root and a relevance callback accepting only `requirements/private`; it must return relevant=false and an empty problem.
 * @evidence contracts/testing.md#independent-expectations The expectation is the authored rule that a directory the population never reads owes no diagnostic: the callback and the entry are both chosen by the test, so the silent result is not read back from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases The negative twin of the relevant-entry cases: same base and cause, but an entry the population does not select; the relevant case is owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAWalkFailureOutsideThePopulationIsNotReported is a Go unit entry in the native test process; it calls unreadableEntryProblem on constructed paths with no filesystem walk, consumer install or product host.
 */
func TestAWalkFailureOutsideThePopulationIsNotReported(t *testing.T) {
  base := resolvePopulationBase(filepath.Join(t.TempDir(), "project"), "../documents")
  problem, relevant := unreadableEntryProblem(
    base,
    base.Absolute,
    "Markdown",
    filepath.Join(base.Absolute, "assets", "private"),
    errors.New("permission denied"),
    func(relative string) bool { return relative == "requirements/private" },
  )
  if relevant || problem != "" {
    t.Fatalf("an unread path owes no diagnostic, got %q", problem)
  }
}
