package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a binding leaf stays a property when the pattern is initialized with
 * a function.
 *
 * The complementary cases destructure records and arrays of data, so the leaf rule is
 * pinned only where nothing could have made a leaf callable. A `const`
 * initialized with a function is the one shape that reaches the callable
 * branch, and the binding-pattern guard is what stops the whole pattern's
 * initializer from being attributed to each leaf.
 *
 * The two pattern kinds are not symmetric. The object row is a program that
 * compiles, since a function does carry `length` and `name`; the array row is
 * `TS2488` under a checker, because a function is not iterable. It is here
 * anyway: the guard covers both kinds, nothing else in the package narrows it,
 * and its shape is what this case is for.
 *
 *  1. Destructure a function into an object pattern and into an array pattern.
 *  2. Collect the inventory.
 *  3. Assert every leaf is a property.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert every leaf is a property.
 * @evidence contracts/testing.md#independent-expectations The complementary cases destructure records and arrays of data, so the leaf rule is pinned only where nothing could have made a leaf callable. A `const` initialized with a function is the one shape that reaches the callable branch, and the binding-pattern guard is what stops the whole pattern's initializer from being attributed to each leaf. The authored scenario requires this outcome: Assert every leaf is a property.
 * @evidence contracts/testing.md#distinguishing-cases Destructure a function into an object pattern and into an array pattern. Collect the inventory. Assert every leaf is a property.
 * @evidence contracts/testing.md#execution-ownership TestDestructuredLeavesStayPropertiesUnderAFunctionInitializer runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestDestructuredLeavesStayPropertiesUnderAFunctionInitializer(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export const { length: named, name: labelled } = function target() {};
export const [firstLeaf, ...restLeaves] = (): void => {};
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:firstLeaf",
    "property:labelled",
    "property:named",
    "property:restLeaves",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "destructured leaves under a function initializer:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
