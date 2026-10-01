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
 * @evidence contracts/testing.md#behavioral-verification unreadableWalkEntryProblem is called for three bases (no declared root, `../documents`, and the absolute documents directory) with a permission-denied cause, and each full message must equal `Evidence graph could not inspect '<path>': permission denied. Fix filesystem access so configured Markdown sources can be indexed.`
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored literals: docs/private, ../documents/requirements/private for the relative root, and the same ascending path for the absolute root, so a reader can open each from the project directory.
 * @evidence contracts/testing.md#distinguishing-cases Three base shapes that change the composition (default, relative root, absolute root) each compared whole, so a wrong prefix, an absolute path or a backslash fails; the real filesystem failure is covered by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAWalkFailureNamesAPathAReaderCanOpen is a Go unit entry in the native test process; it calls resolvePopulationBase and the message builder on constructed values with no filesystem walk, consumer install or product host.
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
