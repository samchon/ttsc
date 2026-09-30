package evidence

import (
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies the default base still names no configuration property.
 *
 * `root: "."` folds into the base every un-rooted population shares, and a
 * stored spelling must not resurrect that as a second base spelled its own way.
 * The two configurations therefore have to produce the same diagnostics, not
 * merely similar ones.
 *
 *  1. Resolve the omitted root and the two spellings that fold onto the project
 *     root, one of which the decoder reduces before this is ever reached.
 *  2. Assert each is the default base and carries no declared spelling.
 *  3. Run a claim with `root: "."` and one with no root, and compare the output.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification resolvePopulationBase marks omitted, dot and dot-slash roots as default, with empty Declared and the project root as label. The rule diagnostics for omitted root and root dot must also agree exactly; this comparison supplements independent literal base-field expectations.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `root: "."` folds into the base every un-rooted population shares, and a stored spelling must not resurrect that as a second base spelled its own way. The two configurations therefore have to produce the same diagnostics, not merely similar ones.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Resolve the omitted root and the two spellings that fold onto the project root, one of which the decoder reduces before this is ever reached. Assert each is the default base and carries no declared spelling. Run a claim with `root: "."` and one with no root, and compare the output.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTheDefaultBaseCarriesNoDeclaredSpelling is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestTheDefaultBaseCarriesNoDeclaredSpelling(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  for _, declared := range []string{"", ".", "./"} {
    base := resolvePopulationBase(root, declared)
    if !base.Default || base.Declared != "" {
      t.Fatalf("root %q must resolve to the default base, got %+v", declared, base)
    }
    if label := populationRootLabel(base); label != filepath.ToSlash(root) {
      t.Fatalf("default label = %q, want the project root", label)
    }
  }
  files := map[string]string{"project/src/sale.ts": "export interface ISale {}\n"}
  reference := `"reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}`
  declared := runRootedGraph(t, files, `{"claims":[{"type":"typescript","root":".",`+
    `"files":["src/**/*.ts"],"symbol":"type",`+reference+`}]}`)
  omitted := runRootedGraph(t, files, `{"claims":[{"type":"typescript",`+
    `"files":["src/**/*.ts"],"symbol":"type",`+reference+`}]}`)
  if strings.Join(declared, "\n") != strings.Join(omitted, "\n") {
    t.Fatalf(
      "a root naming the project is the default base:\ndeclared:\n%s\nomitted:\n%s",
      strings.Join(declared, "\n"),
      strings.Join(omitted, "\n"),
    )
  }
}
