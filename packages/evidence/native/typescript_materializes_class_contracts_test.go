package evidence

import (
  "sort"
  "strings"
  "testing"
)

const classContractSource = `
export class Sale {
  static readonly currency: string = "KRW";
  readonly price: number = 0;
  private secret: number = 0;
  protected internal: number = 0;
  #hidden: number = 0;
  [key: string]: unknown;
  static {}
  constructor(count: number) {
    this.price = count;
  }
  charge(): void {}
  static create(): Sale {
    return new Sale(0);
  }
}
`

/**
 * Verifies class materialization: the class is a type unit and every public
 * member is a unit of its own kind.
 *
 * The class is the subject an obligation belongs to, its methods are what the
 * subject does, and its member variables are the measured facts it carries. The
 * unexported members and the nameless ones are the negative twins: each is a
 * member the loop reaches and must decline for a different reason, so an
 * over-broad filter cannot hide behind the positives.
 *
 *  1. Declare public and non-public members of every class member shape.
 *  2. Collect the inventory.
 *  3. Assert the exact unit set with its symbol kinds.
 */
func TestTypeScriptMaterializesClassContracts(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", classContractSource)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Sale.create",
    "function:Sale.prototype.charge",
    "property:Sale.currency",
    "property:Sale.prototype.price",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "class units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a class contains its own members.
 *
 * Containment is what lets one citation on the subject acknowledge the members
 * it selected, and it is stored as a parent identity rather than derived from
 * the dotted address, because a literal dot inside a name would otherwise
 * collapse into qualification. Before the class was a unit its members hung
 * from whatever enclosed the class, so this is the property that moved.
 *
 *  1. Materialize the same class.
 *  2. Read each member unit's parent identity.
 *  3. Assert every member points at the class and the class points at nothing.
 */
func TestClassIsTheContainmentScopeOfItsMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", classContractSource)
  byTarget := map[string]*evidenceUnit{}
  for _, unit := range inventory.Units {
    byTarget[unit.Target] = unit
  }
  class := byTarget["Sale"]
  if class == nil {
    t.Fatal("the class must materialize a unit to own its members")
  }
  if class.ParentID != "" {
    t.Fatalf("a top-level class has no parent, got %q", class.ParentID)
  }
  for _, target := range []string{
    "Sale.currency",
    "Sale.prototype.price",
    "Sale.prototype.charge",
    "Sale.create",
  } {
    member := byTarget[target]
    if member == nil {
      t.Fatalf("%s must materialize", target)
    }
    if member.ParentID != class.ID {
      t.Fatalf(
        "%s must hang below the class, got parent %q want %q",
        target,
        member.ParentID,
        class.ID,
      )
    }
  }
}

/**
 * Verifies a withdrawn member's other declarations host nothing either.
 *
 * An overload run is one member spelled several times, and the tag sits on
 * whichever declaration the author documented. Resolving withdrawal per node
 * marked the unit and still registered the untagged sibling as a claim host, so
 * a method taken out of the API kept discharging coverage, silently, because
 * the unit really was marked. The unit assertion alone cannot see that: it is
 * the host side that leaks.
 *
 *  1. Withdraw the first declaration of an overload run and cite the second.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the citation is refused and the section stays unacknowledged.
 */
func TestWithdrawnMethodHostsNothingOnItsOtherDeclarations(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/Sale.ts": `
export class Sale {
  /**
   * @internal
   */
  compute(amount: number): void;
  /** @evidence docs/spec.md#pricing A withdrawn method hosts nothing. */
  compute(amount: unknown): void {}
  charge(): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}

/**
 * Verifies a static member's withdrawal leaves an instance member of the same
 * name alone.
 *
 * The withdrawal index is keyed on the identity, and an instance member and a
 * static member of one name are two identities with two addresses. Keying on
 * the bare name would let `@internal` on one silently withdraw the other, which
 * is a public declaration leaving the population with nothing said about it.
 *
 *  1. Withdraw a static member beside an instance member of the same name.
 *  2. Collect the inventory.
 *  3. Assert only the static identity carries the tag.
 */
func TestWithdrawalIsKeyedOnTheMemberIdentity(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  /**
   * @internal
   */
  static parse(value: string): void {}
  parse(value: string): void {}
}
`)
  tagged := []string{}
  for _, unit := range inventory.Units {
    tagged = append(tagged, unit.Symbol+":"+unit.Target+"="+unit.Hidden)
  }
  sort.Strings(tagged)
  want := []string{
    "function:Sale.parse=@internal",
    "function:Sale.prototype.parse=",
    "type:Sale=",
  }
  if strings.Join(tagged, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "same-named member withdrawal:\n%s\nwant:\n%s",
      strings.Join(tagged, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a computed member name materializes nothing.
 *
 * A computed name has no target an author could write, even when its expression
 * is a literal, and the rule is the same one that excludes a private
 * identifier. It is separated from the case above because the exclusion here
 * comes from the name rather than from a modifier, and a repair to one filter
 * must not silently open the other.
 *
 *  1. Declare a class whose only members carry computed names.
 *  2. Collect the inventory.
 *  3. Assert the class alone materializes.
 */
func TestClassComputedMemberNamesMaterializeNothing(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
const key = "dynamic";
export class Sale {
  ["literal"]: number = 0;
  [key]: number = 0;
  [Symbol.iterator](): void {}
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  if strings.Join(units, "\n") != "type:Sale" {
    t.Fatalf("computed member units:\n%s\nwant:\ntype:Sale", strings.Join(units, "\n"))
  }
}

/**
 * Verifies a type-only alias exposes the class type without its members.
 *
 * A class name is type-space, so `export type { Sale }` exposes it exactly as
 * it exposes an interface. `Sale.prototype.price` and `Sale.currency` are paths
 * through the class *value*, which the alias exposes nothing to walk them from.
 * The value-side twin in the same file is what makes the split falsifiable.
 *
 *  1. Export one class by value and another by a type-only alias.
 *  2. Collect the inventory.
 *  3. Assert only the value export contributes members.
 */
func TestTypeOnlyClassAliasExposesNoMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Value {
  price: number = 0;
}
class Local {
  price: number = 0;
}
export type { Local as Shape };
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Value.prototype.price",
    "type:Shape",
    "type:Value",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "type-only class alias units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a withdrawal on a class takes its members with it.
 *
 * `@internal` on the class states that nothing below it is API, and the class
 * is now the declaration that carries the statement. The contract is that a
 * withdrawn unit is **kept** and marked, never discarded, so a citation naming
 * one is answered with the tag instead of sending the author after a typo that
 * is not there. Asserting the exact unit set is what pins both halves: dropping
 * the members instead of marking them would satisfy a check that only read
 * `Hidden` on whatever units happened to exist.
 *
 *  1. Withdraw a class with `@internal`, including a parameter property, and
 *     leave a public class beside it.
 *  2. Collect the inventory.
 *  3. Assert every unit is present and carries exactly the expected tag.
 */
func TestWithdrawnClassTakesItsMembersOutOfThePopulation(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
/**
 * @internal
 */
export class Machinery {
  price: number = 0;
  constructor(public readonly currency: string) {}
  charge(): void {}
}
export class Contract {
  price: number = 0;
}
`)
  tagged := []string{}
  for _, unit := range inventory.Units {
    tagged = append(tagged, unit.Symbol+":"+unit.Target+"="+unit.Hidden)
  }
  sort.Strings(tagged)
  want := []string{
    "function:Machinery.prototype.charge=@internal",
    "property:Contract.prototype.price=",
    "property:Machinery.prototype.currency=@internal",
    "property:Machinery.prototype.price=@internal",
    "type:Contract=",
    "type:Machinery=@internal",
  }
  if strings.Join(tagged, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "withdrawn class units:\n%s\nwant:\n%s",
      strings.Join(tagged, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
