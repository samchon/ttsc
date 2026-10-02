package evidence

import (
  "testing"
)

/**
 * Verifies a type-only star re-export withholds value-space.
 *
 * The star form has no clause to carry a per-name mark, so the declaration's
 * own is the whole answer and a fix keyed on the clause would miss it entirely.
 *
 *  1. Re-export the module with `export type * from`.
 *  2. Point the same reference at the barrel.
 *  3. Assert the same population.
 *
 * @evidence contracts/testing.md#behavioral-verification assertReexportedPopulation exercises the authored fixture. Assert the same population.
 * @evidence contracts/testing.md#independent-expectations The star form has no clause to carry a per-name mark, so the declaration's own is the whole answer and a fix keyed on the clause would miss it entirely. The authored scenario requires this outcome: Assert the same population.
 * @evidence contracts/testing.md#distinguishing-cases Re-export the module with `export type * from`. Point the same reference at the barrel. Assert the same population.
 * @evidence contracts/testing.md#execution-ownership TestTypeOnlyStarReexportWithholdsValueSpace runs as a Go unit entry in the native package. assertReexportedPopulation executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeOnlyStarReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export type * from \"./sale.js\";\n",
    typeReexportPopulation,
  )
}
