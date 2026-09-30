package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a class field is classified by how its type is written, not by what
 * it resolves to.
 *
 * `evidence/graph` reads no type checker, so `isDirectFunctionType` judges the
 * annotation as spelled. An alias of a function type, a constructor type, and
 * a union containing a callable are all properties, while the same signature
 * written out is a function. Four shipped surfaces have described this as "a
 * field that holds a function", which is a different rule and the one a reader
 * would act on, so the boundary is pinned here rather than left to the prose.
 *
 * The annotated fields carry no initializer, so the annotation alone decides
 * them; the one initialized field is there because an arrow initializer is the
 * other, independent route to `function`, and mixing the two in one field would
 * prove neither.
 *
 *  1. Declare annotated fields spelling a callable directly, through an alias,
 *     as a constructor type, and in a union, beside one initialized field.
 *  2. Collect the inventory.
 *  3. Assert only the directly spelled and the initialized ones are functions.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the directly spelled and the initialized ones are functions.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `evidence/graph` reads no type checker, so `isDirectFunctionType` judges the annotation as spelled. An alias of a function type, a constructor type, and a union containing a callable are all properties, while the same signature written out is a function. Four shipped surfaces have described this as "a field that holds a function", which is a different rule and the one a reader would act on, so the boundary is pinned here rather than left to the prose. The authored scenario requires this outcome: Assert only the directly spelled and the initialized ones are functions.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare annotated fields spelling a callable directly, through an alias, as a constructor type, and in a union, beside one initialized field. Collect the inventory. Assert only the directly spelled and the initialized ones are functions.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestClassFieldClassificationIsSyntactic runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestClassFieldClassificationIsSyntactic(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
type Handler = () => void;
export class Sale {
  declare spelled: () => void;
  declare parenthesized: (() => void);
  initialized = (): void => {};
  declare aliased: Handler;
  declare constructed: new () => Sale;
  declare unioned: (() => void) | null;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Sale.prototype.initialized",
    "function:Sale.prototype.parenthesized",
    "function:Sale.prototype.spelled",
    "property:Sale.prototype.aliased",
    "property:Sale.prototype.constructed",
    "property:Sale.prototype.unioned",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "syntactic field classification:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
