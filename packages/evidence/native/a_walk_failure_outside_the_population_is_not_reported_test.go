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
 * documents into a build error. The guard predates this change and has to
 * survive it.
 *
 *  1. Hand the decision a path the population does not read.
 *  2. Read what it returns.
 *  3. Assert it reports nothing.
 * @evidence contracts/testing.md#behavioral-verification unreadableEntryProblem, resolvePopulationBase is exercised with the scenario below; the assertions require it reports nothing.
 * @evidence contracts/testing.md#independent-expectations The negative twin. A permission this population never needed is not its finding, and reporting it would turn an unrelated directory beside the documents into a build error. The guard predates this change and has to survive it.
 * @evidence contracts/testing.md#distinguishing-cases Hand the decision a path the population does not read. Read what it returns. Assert it reports nothing.
 * @evidence contracts/testing.md#execution-ownership TestAWalkFailureOutsideThePopulationIsNotReported is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
