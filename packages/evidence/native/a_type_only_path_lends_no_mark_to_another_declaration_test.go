package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a type-only path lends no mark to another declaration.
 *
 * Two entries under one public name are not always one declaration: an explicit
 * named re-export shadows a star, and the two then name different files. Union
 * the mark across them and the entry describes a path nothing produced, with
 * `Path` from one and the mark from the other, so the value members of a
 * declaration this module reaches only type-only are published. That is the
 * leak the type-only edge exists to stop, arriving through the repair for a
 * different one, and the whole suite stayed green under it.
 *
 * The row asserts the invariant rather than the population: whichever
 * declaration wins the name, nothing reached only through a type-only edge
 * brings its value members. Which one wins is a separate question this
 * traversal answers by source order where TypeScript answers by letting a named
 * re-export shadow a star, and pinning that here would freeze a defect this row
 * is not about.
 *
 *  1. Reach two different classes of one name, one type-only and one by value.
 *  2. Forward both from a middle barrel, in each order, and re-export by name.
 *  3. Assert neither order publishes the type-only declaration's member.
 * @evidence contracts/testing.md#behavioral-verification reexportedFrom runs the graph rule over two classes named Sale (a.ts with `alpha`, b.ts with `beta`) forwarded from a middle barrel by `export type * from a` and `export { Sale } from b` in both orders, re-exported by name from the entry; the test fails if the reported population contains `Sale.prototype.alpha` for either order.
 * @evidence contracts/testing.md#independent-expectations The oracle is the type-only contract that nothing reached only through a type-only edge may publish its value members; it deliberately permits either declaration to win the shared name, so which declaration wins is not asserted.
 * @evidence contracts/testing.md#distinguishing-cases Two orders of the same pair of paths guard against a mark unioned across different declarations. The assertion is one-sided: it does not require `Sale.prototype.beta` or any other member to be published, so a traversal that published nothing would also pass.
 * @evidence contracts/testing.md#execution-ownership TestATypeOnlyPathLendsNoMarkToAnotherDeclaration is a Go unit entry in the native test process; it calls reexportedFrom, which runs the graph rule over temp fixture files, with no consumer install or product host.
 */
func TestATypeOnlyPathLendsNoMarkToAnotherDeclaration(t *testing.T) {
  layout := func(middle string) map[string]string {
    return map[string]string{
      "src/a.ts": `
export class Sale {
  alpha: number = 0;
}
`,
      "src/b.ts": `
export class Sale {
  beta: number = 0;
}
`,
      "src/middle.ts": middle,
      "src/index.ts":  "export { Sale } from \"./middle.js\";\n",
    }
  }
  for _, middle := range []string{
    "export type * from \"./a.js\";\nexport { Sale } from \"./b.js\";\n",
    "export { Sale } from \"./b.js\";\nexport type * from \"./a.js\";\n",
  } {
    for _, target := range reexportedFrom(t, layout(middle), "src/index.ts") {
      if target != "Sale.prototype.alpha" {
        continue
      }
      t.Fatalf(
        "a declaration reached only type-only published a value member for %q",
        strings.TrimSpace(middle),
      )
    }
  }
}
