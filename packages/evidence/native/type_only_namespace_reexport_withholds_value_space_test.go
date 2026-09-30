package evidence

import (
  "testing"
)

/**
 * Verifies a type-only namespace re-export withholds value-space under its
 * segment.
 *
 * `export type * as api from` nests the whole surface one segment deeper, so
 * this row also pins that the withholding travels with the address rather than
 * being decided at the top of it.
 *
 *  1. Re-export the module with `export type * as api from`.
 *  2. Point the same reference at the barrel.
 *  3. Assert the same population, addressed through the segment.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertReexportedPopulation exercises the authored fixture. Assert the same population, addressed through the segment.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `export type * as api from` nests the whole surface one segment deeper, so this row also pins that the withholding travels with the address rather than being decided at the top of it. The authored scenario requires this outcome: Assert the same population, addressed through the segment.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Re-export the module with `export type * as api from`. Point the same reference at the barrel. Assert the same population, addressed through the segment.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeOnlyNamespaceReexportWithholdsValueSpace runs as a Go unit entry in the native package. assertReexportedPopulation executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeOnlyNamespaceReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export type * as api from \"./sale.js\";\n",
    []string{"api.IPlain", "api.IPlain.rate", "api.Sale"},
  )
}
