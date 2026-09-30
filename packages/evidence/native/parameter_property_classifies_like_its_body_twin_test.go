package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a parameter property classifies the same way whichever syntax
 * declared it.
 *
 * A field written as a callable is a function unit in the class body, so the
 * shorthand has to agree. If the two disagreed, moving a field into the
 * constructor would change which selector owns it, which is the dependence on
 * declaration syntax this shorthand support exists to remove.
 *
 * The alias row is what makes the agreement mean something. Both halves of the
 * rule travel: a directly spelled function type is a function on either side,
 * and an alias of that same type is a property on either side, because the test
 * is on how the annotation is written and neither side reads a type checker.
 *
 *  1. Declare function-typed, alias-typed, function-valued and plain-data
 *     parameter properties beside their body twins.
 *  2. Collect the inventory.
 *  3. Assert each pair classifies identically, the data pair included, so the
 *     agreement is not one every field would satisfy.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert each pair classifies identically, the data pair included, so the agreement is not one every field would satisfy.
 * @evidence contracts/testing.md#independent-expectations A field written as a callable is a function unit in the class body, so the shorthand has to agree. If the two disagreed, moving a field into the constructor would change which selector owns it, which is the dependence on declaration syntax this shorthand support exists to remove. The authored scenario requires this outcome: Assert each pair classifies identically, the data pair included, so the agreement is not one every field would satisfy.
 * @evidence contracts/testing.md#distinguishing-cases Declare function-typed, alias-typed, function-valued and plain-data parameter properties beside their body twins. Collect the inventory. Assert each pair classifies identically, the data pair included, so the agreement is not one every field would satisfy.
 * @evidence contracts/testing.md#execution-ownership TestParameterPropertyClassifiesLikeItsBodyTwin runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestParameterPropertyClassifiesLikeItsBodyTwin(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
type Handler = () => void;
export class Sale {
  declare bodyTyped: () => void;
  declare bodyAliased: Handler;
  bodyValued = (): void => {};
  bodyData: number = 0;
  constructor(
    public paramTyped: () => void,
    public paramAliased: Handler,
    public paramValued = (): void => {},
    public paramData: number = 0,
  ) {}
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Sale.prototype.bodyTyped",
    "function:Sale.prototype.bodyValued",
    "function:Sale.prototype.paramTyped",
    "function:Sale.prototype.paramValued",
    "property:Sale.prototype.bodyAliased",
    "property:Sale.prototype.bodyData",
    "property:Sale.prototype.paramAliased",
    "property:Sale.prototype.paramData",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "parameter property classification:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
