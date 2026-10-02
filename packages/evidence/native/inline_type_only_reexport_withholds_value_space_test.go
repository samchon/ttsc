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
 *
 * @evidence contracts/testing.md#behavioral-verification assertReexportedPopulation runs the graph rule over src/sale.ts (class Sale, interface IPlain, function run) and a barrel `export { type Sale, type IPlain, type run } from "./sale.js"`, and requires the entry's unacknowledged population to equal exactly IPlain, IPlain.rate and Sale.
 * @evidence contracts/testing.md#independent-expectations The expected list is authored from the type-only contract: the per-name `type` marker on a specifier withholds value-space members the same way a declaration-level `export type` does, leaving only type-space names and the interface's members.
 * @evidence contracts/testing.md#distinguishing-cases The inline per-specifier spelling, which is marked on the specifier rather than the declaration; a fix that read only the declaration-level marker would publish the value members and fail.
 * @evidence contracts/testing.md#execution-ownership TestInlineTypeOnlyReexportWithholdsValueSpace is a Go unit entry in the native test process; assertReexportedPopulation calls runIndexRule over temp fixture files and compares the Missing-acknowledgement targets, with no consumer install or product host.
 */
func TestInlineTypeOnlyReexportWithholdsValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export { type Sale, type IPlain, type run } from \"./sale.js\";\n",
    typeReexportPopulation,
  )
}
