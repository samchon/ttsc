package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies the variable rule is the inverse of the class-field one.
 *
 * A class field is a callable when it is written as one, annotation included.
 * A variable is a callable only when a `const` is initialized with a function:
 * the annotation never decides, and neither does the initializer on a `let` or
 * a `var`. Several documents draw that contrast, and this case is where it is
 * asserted as a contrast rather than as two rules that happen to be pinned in
 * files which never mention each other.
 *
 * Both halves live here on purpose. Stated apart each reads as an arbitrary
 * rule; together they are what the documents claim, so a change collapsing one
 * onto the other fails here with the relationship named.
 *
 * One scope, deliberately. `collectTypeScriptVariables` reads `prefix` to name
 * a unit and never to classify one, so a namespace row asserts nothing this
 * case does not already assert , a mutation only reddens it by first
 * introducing the scope dependence the code does not have.
 *
 *  1. Declare every variable form beside the class fields they contrast with.
 *  2. Collect the inventory.
 *  3. Assert the only functions are a `const` initialized with a function and
 *     the class's written-as callables.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the only functions are a `const` initialized with a function and the class's written-as callables.
 * @evidence contracts/testing.md#independent-expectations A class field is a callable when it is written as one, annotation included. A variable is a callable only when a `const` is initialized with a function: the annotation never decides, and neither does the initializer on a `let` or a `var`. Several documents draw that contrast, and this case is where it is asserted as a contrast rather than as two rules that happen to be pinned in files which never mention each other. The authored scenario requires this outcome: Assert the only functions are a `const` initialized with a function and the class's written-as callables.
 * @evidence contracts/testing.md#distinguishing-cases Declare every variable form beside the class fields they contrast with. Collect the inventory. Assert the only functions are a `const` initialized with a function and the class's written-as callables.
 * @evidence contracts/testing.md#execution-ownership TestVariableClassificationInvertsTheClassRule runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestVariableClassificationInvertsTheClassRule(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
type Handler = () => void;
export const constInitialized: Handler = () => {};
export declare const constAnnotated: () => void;
export let letInitialized: () => void = () => {};
export declare var varAnnotated: () => void;
export var varInitialized: () => void = () => {};
export class Sale {
  declare annotated: () => void;
  initialized = (): void => {};
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Sale.prototype.annotated",
    "function:Sale.prototype.initialized",
    "function:constInitialized",
    "property:constAnnotated",
    "property:letInitialized",
    "property:varAnnotated",
    "property:varInitialized",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "variable against class classification:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
