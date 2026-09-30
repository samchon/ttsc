package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a modifier other than `private` or `protected` decides nothing
 * about a class or its members.
 *
 * `isPublicClassMember` reads modifier flags and tests exactly two of them, so
 * every other modifier a member can carry is a case where it must not act.
 * `abstract`, `async`, and a decorator reached nothing in this package at all:
 * a guard added to the member walk for any of them left the whole suite green
 * while removing real published contract. `override` reached only the
 * parameter-property row, so its class-body spelling was equally unguarded.
 * `abstract` is the widest, since it takes an abstract base's entire surface,
 * which is the surface a specification is most likely to be written against.
 *
 * `abstract` is also the one that reaches the class itself, and this is the
 * only case that notices a collector refusing to walk an abstract class, so
 * the class arm belongs to the same fixture. The protected member is the
 * negative twin that keeps the assertion from reading as "this class
 * materializes everything", and the abstract function-typed member crosses the
 * modifier axis with the syntactic one.
 *
 *  1. Declare an abstract derived class carrying abstract, override, async,
 *     decorated, static and protected members.
 *  2. Collect the inventory.
 *  3. Assert the same unit set a plain class of that shape would produce.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the same unit set a plain class of that shape would produce.
 * @evidence contracts/testing.md#independent-expectations `isPublicClassMember` reads modifier flags and tests exactly two of them, so every other modifier a member can carry is a case where it must not act. `abstract`, `async`, and a decorator reached nothing in this package at all: a guard added to the member walk for any of them left the whole suite green while removing real published contract. `override` reached only the parameter-property row, so its class-body spelling was equally unguarded. `abstract` is the widest, since it takes an abstract base's entire surface, which is the surface a specification is most likely to be written against. The authored scenario requires this outcome: Assert the same unit set a plain class of that shape would produce.
 * @evidence contracts/testing.md#distinguishing-cases Declare an abstract derived class carrying abstract, override, async, decorated, static and protected members. Collect the inventory. Assert the same unit set a plain class of that shape would produce.
 * @evidence contracts/testing.md#execution-ownership TestModifiersBesideVisibilityDecideNothingAboutAClassOrItsMembers runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestModifiersBesideVisibilityDecideNothingAboutAClassOrItsMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
function log(value: any, context: any): any {
  return value;
}
class Base {
  rate: number = 0;
  settle(): void {}
}
export abstract class Sale extends Base {
  abstract readonly price: number;
  abstract handler: () => void;
  abstract charge(): void;
  protected abstract audit(): void;
  override rate: number = 0;
  override settle(): void {}
  async load(): Promise<void> {}
  @log tagged(): void {}
  static abstract_: number = 0;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Sale.prototype.charge",
    "function:Sale.prototype.handler",
    "function:Sale.prototype.load",
    "function:Sale.prototype.settle",
    "function:Sale.prototype.tagged",
    "property:Sale.abstract_",
    "property:Sale.prototype.price",
    "property:Sale.prototype.rate",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "modifier-carrying class units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
