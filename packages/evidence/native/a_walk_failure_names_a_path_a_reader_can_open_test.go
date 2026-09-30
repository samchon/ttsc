package evidence

import (
  "errors"
  "path/filepath"
  "testing"
)

/**
 * Verifies a walk failure names its path the way the file messages beside it
 * do.
 *
 * The path a `filepath.WalkDir` callback hands back is OS-native and absolute,
 * and it was printed as it arrived, so one loader spelled paths three ways
 * depending on which line reported. This covers the base shapes that change the
 * composition: no declared root, one declared relatively, and one declared
 * absolutely, where the location still ascends project-relatively.
 *
 *  1. Compose the message for each base shape.
 *  2. Read the path it names.
 *  3. Assert it is project-relative and slash-separated.
 * @evidence contracts/testing.md#behavioral-verification unreadableWalkEntryProblem, resolvePopulationBase is exercised with the scenario below; the assertions require it is project-relative and slash-separated.
 * @evidence contracts/testing.md#independent-expectations The path a `filepath.WalkDir` callback hands back is OS-native and absolute, and it was printed as it arrived, so one loader spelled paths three ways depending on which line reported. This covers the base shapes that change the composition: no declared root, one declared relatively, and one declared absolutely, where the location still ascends project-relatively.
 * @evidence contracts/testing.md#distinguishing-cases Compose the message for each base shape. Read the path it names. Assert it is project-relative and slash-separated.
 * @evidence contracts/testing.md#execution-ownership TestAWalkFailureNamesAPathAReaderCanOpen is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestAWalkFailureNamesAPathAReaderCanOpen(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  cause := errors.New("permission denied")
  for _, entry := range []struct {
    declared string
    relative string
    expected string
  }{
    {"", "docs/private", "docs/private"},
    {"../documents", "requirements/private", "../documents/requirements/private"},
    {
      filepath.ToSlash(filepath.Join(workspace, "documents")),
      "requirements/private",
      "../documents/requirements/private",
    },
  } {
    base := resolvePopulationBase(root, entry.declared)
    problem := unreadableWalkEntryProblem(base, entry.relative, "Markdown", cause)
    want := "Evidence graph could not inspect '" + entry.expected +
      "': permission denied. Fix filesystem access so configured Markdown sources can be indexed."
    if problem != want {
      t.Fatalf("root %q entry %q:\n got %s\nwant %s", entry.declared, entry.relative, problem, want)
    }
  }
}
