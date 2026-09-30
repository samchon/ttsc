package evidence

import (
  "testing"
)

/**
 * Verifies the inline spelling withholds the same thing.
 *
 * `export { type Sale } from` is the per-name form and it is marked on the
 * specifier rather than on the declaration, so a fix reading only one of the two
 * would answer this spelling wrongly while the other looked closed.
 *
 *  1. Re-export the same three declarations with `export { type … } from`.
 *  2. Point the same reference at the barrel.
 *  3. Assert the same population as the declaration-level spelling.
 * @evidence contracts/testing.md#behavioral-verification assertReexportedPopulation exercises the authored fixture. Assert the same population as the declaration-level spelling.
 * @evidence contracts/testing.md#independent-expectations `export { type Sale } from` is the per-name form and it is marked on the specifier rather than on the declaration, so a fix reading only one of the two would answer this spelling wrongly while the other looked closed. The authored scenario requires this outcome: Assert the same population as the declaration-level spelling.
 * @evidence contracts/testing.md#distinguishing-cases Re-export the same three declarations with `export { type … } from`. Point the same reference at the barrel. Assert the same population as the declaration-level spelling.
 * @evidence contracts/testing.md#execution-ownership TestInlineTypeOnlyReexportWithholdsValueSpace runs as a Go unit entry in the native package. assertReexportedPopulation executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestInlineTypeOnlyReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export { type Sale, type IPlain, type run } from \"./sale.js\";\n",
    typeReexportPopulation,
  )
}
