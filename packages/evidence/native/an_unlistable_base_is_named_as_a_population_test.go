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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification unlistableBaseProblem, resolvePopulationBase is exercised with the scenario below; the assertions require the declared spelling is used, and the project root where there is no declared spelling to use.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A base the walk could not list costs every unit there is, so it is a finding about the population and names the property that selected it. The per-entry message beside it names a path a reader opens, and the two would be indistinguishable if this one spelled a location too.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Compose the message for a declared root and for the default base. Read each one. Assert the declared spelling is used, and the project root where there is no declared spelling to use.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAnUnlistableBaseIsNamedAsAPopulation is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
