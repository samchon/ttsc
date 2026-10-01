package evidence

import (
  "errors"
  "path/filepath"
  "testing"
)

/**
 * Verifies an unlistable base is named as a population rather than as an entry.
 *
 * A base the walk could not list costs every unit there is, so it is a finding
 * about the population and names the property that selected it. The per-entry
 * message beside it names a path a reader opens, and the two would be
 * indistinguishable if this one spelled a location too.
 *
 *  1. Compose the message for a declared root and for the default base.
 *  2. Read each one.
 *  3. Assert the declared spelling is used, and the project root where there is
 *     no declared spelling to use.
 * @evidence contracts/testing.md#behavioral-verification unlistableBaseProblem is called for a Markdown base with root `../documents` and for the default base, with a permission-denied cause; the messages must equal `Evidence graph could not walk Markdown root '../documents': permission denied. Make that root a directory this process can list, so its configured Markdown sources can be indexed.` and the same sentence naming the slash-separated project root.
 * @evidence contracts/testing.md#independent-expectations Both expected messages are authored literals; the default-base expectation is built from the test's own temp project path, so the fallback to the project root is checked against a value the builder did not produce.
 * @evidence contracts/testing.md#distinguishing-cases A declared root against the default base, the two cases where the spelling to print comes from different sources; the per-entry message form is owned by sibling walk-failure entries.
 * @evidence contracts/testing.md#execution-ownership TestAnUnlistableBaseIsNamedAsAPopulation is a Go unit entry in the native test process; it calls resolvePopulationBase and the message builder on constructed values with no filesystem walk, consumer install or product host.
 */
func TestAnUnlistableBaseIsNamedAsAPopulation(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  cause := errors.New("permission denied")
  declared := unlistableBaseProblem(resolvePopulationBase(root, "../documents"), "Markdown", cause)
  want := "Evidence graph could not walk Markdown root '../documents': permission denied. " +
    "Make that root a directory this process can list, so its configured Markdown sources can be indexed."
  if declared != want {
    t.Fatalf("declared root:\n got %s\nwant %s", declared, want)
  }
  fallback := unlistableBaseProblem(resolvePopulationBase(root, ""), "Markdown", cause)
  wantFallback := "Evidence graph could not walk Markdown root '" + filepath.ToSlash(root) +
    "': permission denied. Make that root a directory this process can list, so its configured Markdown sources can be indexed."
  if fallback != wantFallback {
    t.Fatalf("default base:\n got %s\nwant %s", fallback, wantFallback)
  }
}
