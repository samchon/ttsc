package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a constructor parameter property is the field it declares.
 *
 * `constructor(public readonly price: number)` declares the same public
 * instance field as `readonly price: number` in the class body, so the two
 * syntaxes must materialize the same unit. The ordinary parameter beside it is
 * the negative twin that keeps the modifier check falsifiable: without it, a
 * collector that had started selecting every constructor parameter would look
 * identical here.
 *
 * The modifier axis is enumerated rather than sampled. TypeScript's
 * `ParameterPropertyModifier` mask holds five modifiers, and `override` is the
 * one that carries no visibility of its own, so a list written from the four
 * familiar ones selects a field the compiler declares and this collector
 * already materializes.
 *
 *  1. Declare public, readonly, override, modifier-less, private, and
 *     protected constructor parameters beside a body field.
 *  2. Collect the inventory.
 *  3. Assert only the public parameter properties join the body field.
 */
func TestTypeScriptMaterializesParameterProperties(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
class Base {
  rate: number = 0;
}
export class Sale extends Base {
  readonly declared: number = 0;
  constructor(
    public readonly price: number,
    readonly currency: string,
    override rate: number,
    plain: number,
    private ledger: number,
    protected audit: number,
  ) {
    super();
  }
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Sale.prototype.currency",
    "property:Sale.prototype.declared",
    "property:Sale.prototype.price",
    "property:Sale.prototype.rate",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "parameter property units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a parameter property hangs below its class like a body field.
 *
 * The shorthand has to reach the same containment scope, or a citation on the
 * class would acknowledge the fields written in the body and silently miss the
 * ones written in the constructor.
 *
 *  1. Declare one body field and one parameter property.
 *  2. Materialize the inventory.
 *  3. Assert both point at the class unit.
 */
func TestParameterPropertyHangsBelowItsClass(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  readonly declared: number = 0;
  constructor(public readonly price: number) {}
}
`)
  byTarget := map[string]*evidenceUnit{}
  for _, unit := range inventory.Units {
    byTarget[unit.Target] = unit
  }
  class := byTarget["Sale"]
  if class == nil {
    t.Fatal("the class must materialize a unit to own its fields")
  }
  for _, target := range []string{"Sale.prototype.declared", "Sale.prototype.price"} {
    field := byTarget[target]
    if field == nil {
      t.Fatalf("%s must materialize", target)
    }
    if field.ParentID != class.ID {
      t.Fatalf(
        "%s must hang below the class, got parent %q want %q",
        target,
        field.ParentID,
        class.ID,
      )
    }
  }
}

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

/**
 * Verifies a private constructor still declares its public fields.
 *
 * The constructor's own visibility closes construction from outside; it says
 * nothing about the instance fields the object then exposes. Gating the
 * parameters on the constructor's modifiers would drop every field of a class
 * built through a static factory, which is a shape this exclusion would hit
 * squarely.
 *
 *  1. Declare a public parameter property on a private constructor.
 *  2. Collect the inventory.
 *  3. Assert the field materializes and the non-public parameter does not.
 */
func TestPrivateConstructorStillDeclaresItsPublicFields(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  private constructor(
    public readonly price: number,
    private ledger: number,
  ) {}
  static create(price: number): Sale {
    return new Sale(price, 0);
  }
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Sale.create",
    "property:Sale.prototype.price",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "private constructor units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a parameter property carries its own citation.
 *
 * Materializing the unit is only half of the repair. TypeScript attaches a
 * leading block to the parameter rather than to the constructor, and unless
 * the parameter is registered as a claim host too, the field would be visible
 * as evidence while unable to cite anything of its own.
 *
 * The uncited second section is what keeps that checkable. A claim whose
 * selected hosts all vanish deactivates and reports nothing, so asserting
 * silence would pass just as well if parameter properties stopped being units
 * at all. Demanding that exactly the uncited section is reported proves the
 * claim was live and the cited one really was discharged from the parameter.
 *
 *  1. Cite one of two Markdown sections from a parameter property.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the uncited section is the only thing reported.
 */
func TestParameterPropertyIsAClaimHost(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n\n## Uncited {#uncited}\n\nNothing answers for this.\n",
    "src/Sale.ts": `
export class Sale {
  constructor(
    /** @evidence docs/spec.md#price The price this section fixes. */
    public readonly price: number,
  ) {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "Missing acknowledgement for 'docs/spec.md#uncited'")
}

/**
 * Verifies a destructured constructor parameter materializes nothing.
 *
 * `constructor(public { a, b }: T)` is `TS1187`, so no unit may come of it. It
 * is pinned because the sibling collector for destructured exports does the
 * opposite and expands every binding leaf: aligning the two later would
 * silently materialize `Sale.prototype.a` from a parameter TypeScript rejects,
 * with nothing to catch it. The plain parameter property beside it is the
 * control that keeps the case honest.
 *
 *  1. Declare a destructured parameter carrying a property modifier.
 *  2. Collect the inventory.
 *  3. Assert only the ordinary parameter property materializes.
 */
func TestDestructuredParameterPropertyMaterializesNothing(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export interface IOptions {
  a: number;
  b: number;
}
export class Sale {
  constructor(
    public { a, b }: IOptions,
    public readonly price: number,
  ) {}
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:IOptions.a",
    "property:IOptions.b",
    "property:Sale.prototype.price",
    "type:IOptions",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "destructured parameter units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a constructor with no parameters and a constructor overload run
 * materialize nothing of their own.
 *
 * The constructor is read now rather than skipped, so the shapes that carry no
 * parameter property have to leave the population exactly as they found it. The
 * overload half is a boundary rather than a doubling risk, since units dedupe
 * by identity: what it pins is that walking three constructor nodes instead of
 * one adds nothing and drops nothing.
 *
 *  1. Declare an empty constructor in one class and an overload run in another.
 *  2. Collect the inventory.
 *  3. Assert only the implementation's parameter property materializes.
 */
func TestConstructorsWithoutParameterPropertiesAddNothing(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Empty {
  constructor() {}
}
export class Overloaded {
  constructor(price: number);
  constructor(price: string);
  constructor(public readonly price: number | string) {}
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Overloaded.prototype.price",
    "type:Empty",
    "type:Overloaded",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "constructor units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a withdrawal on the constructor reaches the fields it declares.
 *
 * A constructor declares units without being one, so it is the only container
 * whose withdrawal tag could be dropped on the way to its descendants. The
 * class-level and field-level tags both already cascade, and an `@internal`
 * constructor that left its fields in the population would be the one hole in
 * that rule, silently keeping a field the author withdrew as a claim host.
 *
 *  1. Withdraw a constructor with `@internal` beside an ordinary field.
 *  2. Collect the inventory.
 *  3. Assert its parameter property carries the tag and the field does not.
 */
func TestWithdrawnConstructorWithdrawsItsParameterProperties(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  readonly declared: number = 0;
  /**
   * @internal
   */
  private constructor(public readonly price: number) {}
}
`)
  tagged := []string{}
  for _, unit := range inventory.Units {
    tagged = append(tagged, unit.Symbol+":"+unit.Target+"="+unit.Hidden)
  }
  sort.Strings(tagged)
  want := []string{
    "property:Sale.prototype.declared=",
    "property:Sale.prototype.price=@internal",
    "type:Sale=",
  }
  if strings.Join(tagged, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "withdrawn constructor units:\n%s\nwant:\n%s",
      strings.Join(tagged, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a withdrawal on a constructor overload signature still reaches the
 * fields the implementation declares.
 *
 * An overload run is one constructor written several times, and a signature is
 * where JSDoc for an overloaded declaration conventionally goes, while only the
 * implementation carries parameter properties. Reading the tag from the node
 * being visited would make the withdrawal depend on which half the author
 * documented.
 *
 * Three positions are asserted together because each kills a different way of
 * getting this wrong. A tag on the first signature dies under "read the visited
 * node". A tag on the implementation alone dies under "read the first
 * constructor and stop", which is the shape that worked before the scan
 * existed. Two competing tags pin first-in-source-order, matching how a
 * statement list resolves a merged declaration's withdrawal.
 *
 *  1. Withdraw a different constructor declaration in each of three classes.
 *  2. Collect each inventory.
 *  3. Assert the parameter property carries the expected tag every time.
 */
func TestWithdrawnConstructorSignatureWithdrawsItsParameterProperties(t *testing.T) {
  for _, testCase := range []struct {
    name   string
    source string
    want   string
  }{
    {
      name: "on the first signature",
      source: `
  /**
   * @internal
   */
  constructor(price: number);
  constructor(price: string);
  constructor(public readonly price: number | string) {}`,
      want: "@internal",
    },
    {
      name: "on the implementation alone",
      source: `
  constructor(price: number);
  constructor(price: string);
  /**
   * @internal
   */
  constructor(public readonly price: number | string) {}`,
      want: "@internal",
    },
    {
      name: "the first of two competing tags",
      source: `
  /**
   * @hidden
   */
  constructor(price: number);
  /**
   * @internal
   */
  constructor(price: string);
  constructor(public readonly price: number | string) {}`,
      want: "@hidden",
    },
  } {
    t.Run(testCase.name, func(t *testing.T) {
      inventory := parseTypeScriptInventory(t, "src/Order.ts", `
export class Order {
  readonly declared: number = 0;`+testCase.source+`
}
`)
      tagged := []string{}
      for _, unit := range inventory.Units {
        tagged = append(tagged, unit.Symbol+":"+unit.Target+"="+unit.Hidden)
      }
      sort.Strings(tagged)
      want := []string{
        "property:Order.prototype.declared=",
        "property:Order.prototype.price=" + testCase.want,
        "type:Order=",
      }
      if strings.Join(tagged, "\n") != strings.Join(want, "\n") {
        t.Fatalf(
          "withdrawn constructor units:\n%s\nwant:\n%s",
          strings.Join(tagged, "\n"),
          strings.Join(want, "\n"),
        )
      }
    })
  }
}

/**
 * Verifies a citation on the class acknowledges a parameter property.
 *
 * `ParentID` is a proxy for this; the obligation is what the author actually
 * meets. The reference selects only the fields, so the class is an unselected
 * ancestor, and one citation on it has to discharge both syntaxes at once or a
 * project mixing them would be told to cite the same subject twice.
 *
 * The uncited sibling class is what keeps that checkable, and it declares its
 * field through the shorthand. A case whose whole population is the shorthand
 * would go silent when parameter properties stopped materializing, because the
 * claim would deactivate; a case mixing both syntaxes in the cited class alone
 * would stay green because the body field survived. The sibling separates the
 * two: it fixes the expected count, and it is the shorthand that has to
 * materialize for that count to be one.
 *
 *  1. Select two classes' fields, mixing both syntaxes in the cited one.
 *  2. Cite that class itself, once, from another module.
 *  3. Assert the uncited class's parameter property is the only thing reported.
 */
func TestClassCitationAcknowledgesItsParameterProperties(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "src/Sale.ts": `
export class Sale {
  readonly declared: number = 0;
  constructor(public readonly price: number) {}
}
export class Uncited {
  constructor(public readonly rate: number) {}
}
`,
    "src/ledger.ts": `
import type { Sale } from "./Sale.js";

/** @evidence {@link Sale} Records every fact this subject owns. */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{
      "type":"typescript",
      "files":["src/Sale.ts"],
      "symbol":["property"]
    }
  }]}`), "Missing acknowledgement for 'Uncited.prototype.rate'")
}

/**
 * Verifies a citation on a non-public parameter property is refused.
 *
 * The unit-set case proves a private parameter property materializes nothing;
 * this proves the host side agrees. A declaration that is not a unit must not
 * be a place a tag can sit either, or an author would write a citation the
 * graph counts for nothing and reports nowhere.
 *
 *  1. Cite a Markdown section from a private parameter property.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the unsupported-host diagnostic.
 */
func TestPrivateParameterPropertyIsNotAClaimHost(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n",
    "src/Sale.ts": `
export class Sale {
  public readonly total: number = 0;
  constructor(
    /** @evidence docs/spec.md#price A private field hosts nothing. */
    private readonly price: number,
  ) {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "unsupported or non-exported declaration")
}

/**
 * Verifies a citation on the constructor itself is refused.
 *
 * The twin of the case above, and the boundary between them. A constructor
 * materializes no unit, so a block above it hosts nothing, and an author who
 * put the tag one line too high has to be told rather than silently credited
 * with the parameter's obligation.
 *
 *  1. Cite the same section from the constructor rather than its parameter.
 *  2. Evaluate the same claim.
 *  3. Assert the unsupported-host diagnostic.
 */
func TestConstructorItselfIsNotAClaimHost(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidence docs/spec.md#price A constructor hosts nothing. */
  constructor(public readonly price: number) {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "unsupported or non-exported declaration")
}
