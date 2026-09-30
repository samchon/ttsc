package evidence

import (
  "testing"
)

/**
 * Verifies a merged identity survives a type-only edge whichever half is first.
 *
 * One unit can be written by two collectors: `interface Order { member }`
 * beside `namespace Order { export const member }` is one `property` unit
 * spelled by the member collector and by the variable one. Recording which
 * space it is reached through by assignment made the last writer win, so the
 * answer followed declaration order, and the suppression it feeds is silent in
 * both directions. Type-space wins instead, because the interface half really
 * is reachable without a value.
 *
 *  1. Write the merge in both orders behind a type-only re-export.
 *  2. Read each population.
 *  3. Assert both keep the member.
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom exercises the authored fixture. Assert both keep the member.
 * @evidence contracts/testing.md#independent-expectations One unit can be written by two collectors: `interface Order { member }` beside `namespace Order { export const member }` is one `property` unit spelled by the member collector and by the variable one. Recording which space it is reached through by assignment made the last writer win, so the answer followed declaration order, and the suppression it feeds is silent in both directions. Type-space wins instead, because the interface half really is reachable without a value. The authored scenario requires this outcome: Assert both keep the member.
 * @evidence contracts/testing.md#distinguishing-cases Write the merge in both orders behind a type-only re-export. Read each population. Assert both keep the member.
 * @evidence contracts/testing.md#execution-ownership TestMergedIdentitySurvivesATypeOnlyEdgeWhicheverHalfIsFirst runs as a Go unit entry in the native package. assertReexportedFrom executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestMergedIdentitySurvivesATypeOnlyEdgeWhicheverHalfIsFirst(t *testing.T) {
  layout := func(source string) map[string]string {
    return map[string]string{
      "src/order.ts": source,
      "src/index.ts": "export type { Order } from \"./order.js\";\n",
    }
  }
  want := []string{"Order", "Order.member"}
  assertReexportedFrom(t, "interface first", layout(`
export interface Order {
  member: number;
}
export namespace Order {
  export const member: number = 1;
}
`), "src/index.ts", want)
  assertReexportedFrom(t, "namespace first", layout(`
export namespace Order {
  export const member: number = 1;
}
export interface Order {
  member: number;
}
`), "src/index.ts", want)
}
