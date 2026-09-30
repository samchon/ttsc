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
 * @evidence contracts/testing.md#behavioral-verification reexportedFrom exercises the authored fixture. Assert neither order publishes the type-only declaration's member.
 * @evidence contracts/testing.md#independent-expectations Two entries under one public name are not always one declaration: an explicit named re-export shadows a star, and the two then name different files. Union the mark across them and the entry describes a path nothing produced, with `Path` from one and the mark from the other, so the value members of a declaration this module reaches only type-only are published. That is the leak the type-only edge exists to stop, arriving through the repair for a different one, and the whole suite stayed green under it. The oracle deliberately permits either conflicting declaration to win; named-export shadowing versus source order remains outside this assertion. The authored scenario requires this outcome: Assert neither order publishes the type-only declaration's member.
 * @evidence contracts/testing.md#distinguishing-cases Reach two different classes of one name, one type-only and one by value. Forward both from a middle barrel, in each order, and re-export by name. Assert neither order publishes the type-only declaration's member.
 * @evidence contracts/testing.md#execution-ownership TestATypeOnlyPathLendsNoMarkToAnotherDeclaration runs as a Go unit entry in the native package. reexportedFrom executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
