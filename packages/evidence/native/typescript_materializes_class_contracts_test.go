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
 * Verifies the same reconciliation reaches a merged interface's members.
 *
 * The host set is filled one node at a time by whichever collector walked the
 * container, and withdrawal belongs to the identity, so every declaration form
 * that can spell one identity twice has the same leak. An interface declared
 * twice is the second such form: TypeScript accepts a repeated member whose type
 * matches, and the untagged copy kept discharging coverage. Closing the class
 * once rather than per container is what this pins.
 *
 *  1. Withdraw a property in one interface declaration and cite it from the
 *     other.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the citation is refused and the section stays unacknowledged.
 */
func TestWithdrawnInterfacePropertyHostsNothingOnItsOtherDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/ISale.ts": `
export interface ISale {
  /**
   * @internal
   */
  price: number;
  live: number;
}
export interface ISale {
  /** @evidence docs/spec.md#pricing A withdrawn property hosts nothing. */
  price: number;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ISale.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}

/**
 * Verifies the withdrawal reaches a run whose tagged half comes second.
 *
 * The unit is marked by whichever declaration carries the tag, not by the one
 * written first, and that back-fill is the whole mechanism the host
 * reconciliation reads. Every other case here tags the first declaration, so
 * removing the back-fill left the suite green while an untagged-first run
 * silently went back to hosting a citation.
 *
 *  1. Cite the first declaration of an overload run and withdraw the second.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the citation is refused and the section stays unacknowledged.
 */
func TestWithdrawalReachesARunTaggedAfterTheCitation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidence docs/spec.md#pricing The untagged half hosts nothing either. */
  compute(amount: number): void;
  /**
   * @internal
   */
  compute(amount: string): void;
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
 * Verifies withdrawing one identity leaves a sibling sharing its host position.
 *
 * `export var price, live` is two identities and one statement, because
 * TypeScript attaches their documentation block to the wrapper. Giving up that
 * position whenever any identity reaching it is withdrawn refused a citation on
 * `live`, which nobody had tagged and which is fully public. The rule is that a
 * position is given up only when every identity reaching it is gone.
 *
 * Asserting silence would not do. An empty selected population is silent too,
 * so a change that stopped materializing the second declarator at all would
 * keep this green while the position it is about ceased to exist. The reference
 * therefore carries a section nobody cites, which makes the expected count one
 * rather than zero, and it is the exact count that constrains. Measured: `live`
 * losing its unit takes the count to zero, because the claim then has no
 * selected host left and deactivates; `live` losing its host takes it to three,
 * two unacknowledged sections and one refused host.
 *
 *  1. Withdraw one identity through a merged namespace and cite its public
 *     sibling on the shared statement.
 *  2. Evaluate a `symbol: "property"` claim over that file, against a reference
 *     holding one cited and one uncited section.
 *  3. Assert the uncited section is the only thing reported.
 */
func TestWithdrawalSparesASiblingSharingTheHostPosition(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n\n## Uncited {#uncited}\n",
    "src/values.ts": `
export namespace N {
  /**
   * @internal
   */
  export var price: number;
}
export namespace N {
  /** @evidence docs/spec.md#pricing The live field answers this. */
  export var price: number, live: number;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/values.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`), "Missing acknowledgement for 'docs/spec.md#uncited'")
}

/**
 * Verifies a withdrawn member is not an exclusion carrier either.
 *
 * Carrier eligibility is wider than host eligibility, and it reads the same
 * host set, so a leak there is a second way for a withdrawn declaration to
 * settle an obligation. Excluding through one is worse than citing through one:
 * the reason field makes it read as a reviewed decision.
 *
 *  1. Exclude a section from the untagged half of a withdrawn member.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the carrier is refused and the section stays unacknowledged.
 */
func TestWithdrawnMemberIsNotAnExclusionCarrier(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/Sale.ts": `
export class Sale {
  /**
   * @internal
   */
  compute(amount: number): void;
  /** @evidenceExclude docs/spec.md#pricing A withdrawn method carries nothing. */
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
  assertProblemContains(t, messages, "not an eligible exclusion carrier")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}

/**
 * Verifies a static member's withdrawal leaves an instance member of the same
 * name alone.
 *
 * Withdrawal follows the unit identity, and an instance member and a static
 * member of one name are two identities with two addresses. Resolving it by the
 * bare name would let `@internal` on one silently withdraw the other, which is
 * a public declaration leaving the population with nothing said about it.
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
 * Verifies the first tag in source order names the withdrawal.
 *
 * A citation of a withdrawn target is answered by quoting the tag back, so
 * which of two competing tags wins decides which line the diagnostic sends the
 * author to. Last-wins would read identically in every other case, and this is
 * the same rule a statement list already applies to a merged declaration.
 *
 *  1. Tag two declarations of one member with different withdrawal tags.
 *  2. Collect the inventory.
 *  3. Assert the first one names the withdrawal.
 */
func TestFirstWithdrawalTagInSourceOrderWins(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  /**
   * @hidden
   */
  compute(amount: number): void;
  /**
   * @internal
   */
  compute(amount: string): void;
  compute(amount: unknown): void {}
}
`)
  for _, unit := range inventory.Units {
    if unit.Target != "Sale.prototype.compute" {
      continue
    }
    if unit.Hidden != "@hidden" {
      t.Fatalf("the first tag must name the withdrawal, got %q", unit.Hidden)
    }
    return
  }
  t.Fatal("the withdrawn member must still materialize, marked")
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
 * The ordinary field beside them is the control. Without it the expected set
 * would be the class alone, which is also what a collector that had stopped
 * materializing class members entirely produces, and the case would pass while
 * proving nothing about computed names.
 *
 *  1. Declare a class whose members carry computed names beside one ordinary
 *     field.
 *  2. Collect the inventory.
 *  3. Assert the class and that field are the whole set.
 */
func TestClassComputedMemberNamesMaterializeNothing(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
const key = "dynamic";
export class Sale {
  ["literal"]: number = 0;
  [key]: number = 0;
  [Symbol.iterator](): void {}
  named: number = 0;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Sale.prototype.named",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "computed member units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
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
 * Both halves and both scopes live here on purpose. Stated apart each reads as
 * an arbitrary rule; together they are what the documents claim, so a change
 * collapsing one onto the other fails here with the relationship named. The
 * positive half is pinned elsewhere for a bare `const` at either scope; what
 * this case adds is the alias-annotated variant of it, and the negatives — that
 * a declaration's annotation and a non-`const`'s initializer decide nothing,
 * measured at both scopes rather than at one and assumed at the other.
 *
 *  1. Declare every variable form at module and at namespace scope, beside the
 *     class fields they contrast with.
 *  2. Collect the inventory.
 *  3. Assert the only functions are a `const` initialized with a function and
 *     the class's written-as callables.
 */
func TestVariableClassificationInvertsTheClassRule(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
type Handler = () => void;
export const constInitialized: Handler = () => {};
export declare const constAnnotated: () => void;
export let letInitialized: () => void = () => {};
export declare var varAnnotated: () => void;
export var varInitialized: () => void = () => {};
export namespace api {
  export const nestedInitialized: Handler = () => {};
  export declare const nestedAnnotated: () => void;
  export let nestedLet: () => void = () => {};
  export var nestedVar: () => void = () => {};
}
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
    "function:api.nestedInitialized",
    "function:constInitialized",
    "property:api.nestedAnnotated",
    "property:api.nestedLet",
    "property:api.nestedVar",
    "property:constAnnotated",
    "property:letInitialized",
    "property:varAnnotated",
    "property:varInitialized",
    "type:Sale",
    "type:api",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "variable against class classification:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
