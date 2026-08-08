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
 *  1. Declare public, modifier-less, private, and protected constructor
 *     parameters beside a body field.
 *  2. Collect the inventory.
 *  3. Assert only the public parameter properties join the body field.
 */
func TestTypeScriptMaterializesParameterProperties(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  readonly declared: number = 0;
  constructor(
    public readonly price: number,
    readonly currency: string,
    plain: number,
    private ledger: number,
    protected audit: number,
  ) {}
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
 * Verifies a parameter property classifies by its value, not by its syntax.
 *
 * A field declared with a direct function type is a function unit in the class
 * body, so the shorthand has to agree. If the two disagreed, moving a field
 * into the constructor would change which selector owns it, which is the
 * syntax dependence this shorthand support exists to remove.
 *
 *  1. Declare function-typed and function-valued parameter properties.
 *  2. Collect the inventory.
 *  3. Assert they classify exactly as their body twins do.
 */
func TestParameterPropertyClassifiesLikeItsBodyTwin(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  bodyTyped: () => void = () => {};
  bodyValued = (): void => {};
  bodyData: number = 0;
  constructor(
    public paramTyped: () => void,
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
    "property:Sale.prototype.bodyData",
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
 *  1. Cite a Markdown section from a parameter property.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert no diagnostic at all.
 */
func TestParameterPropertyIsAClaimHost(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n",
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
  }]}`))
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
