package evidence

import (
  "testing"
)

/**
 * Verifies a named type-only re-export withholds value-space across the module
 * boundary.
 *
 * The mark stopped at the boundary: `collectLocalExportNames` skips any export
 * declaration carrying a module specifier, so a barrel published every class
 * member the declaring file held while the same intent written locally withheld
 * them. The criterion had become the specifier rather than the export's own
 * kind, which is a distinction with nothing behind it, and every surface that
 * stated the type-only rule had to carry a caveat about it.
 *
 *  1. Re-export the same three declarations with `export type { … } from`.
 *  2. Point the same reference at the barrel.
 *  3. Assert the class name and the whole unmerged interface survive and
 *     nothing else does.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertReexportedPopulation exercises the authored fixture. Assert the class name and the whole unmerged interface survive and nothing else does.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The mark stopped at the boundary: `collectLocalExportNames` skips any export declaration carrying a module specifier, so a barrel published every class member the declaring file held while the same intent written locally withheld them. The criterion had become the specifier rather than the export's own kind, which is a distinction with nothing behind it, and every surface that stated the type-only rule had to carry a caveat about it. The authored scenario requires this outcome: Assert the class name and the whole unmerged interface survive and nothing else does.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Re-export the same three declarations with `export type { … } from`. Point the same reference at the barrel. Assert the class name and the whole unmerged interface survive and nothing else does.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeOnlyNamedReexportWithholdsValueSpace runs as a Go unit entry in the native package. assertReexportedPopulation executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeOnlyNamedReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export type { Sale, IPlain, run } from \"./sale.js\";\n",
    typeReexportPopulation,
  )
}
