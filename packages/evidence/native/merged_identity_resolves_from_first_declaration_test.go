package evidence

import "testing"

const mergedIdentityGraphConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":["type","function","property"],
  "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
}]}`

const mergedIdentityReferenceConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/claim.ts"],
  "symbol":"type",
  "reference":{"type":"typescript","files":["src/subject.ts"],"symbol":"type"}
}]}`

/**
 * Verifies a merged identity reports the declaration encountered first.
 *
 * Every diagnostic that names a line for such an identity names this one, and
 * nothing pins it: `addTypeScriptUnit` creates the unit on the first
 * materialization and returns the existing one afterwards, so the reported line
 * is a consequence of statement order rather than a stated rule. Making a later
 * declaration win would be a one-line change with no failing test, and the
 * whole campaign now assumes the opposite.
 *
 *  1. Spell one identity through two declarations, in both orders.
 *  2. Materialize the inventory.
 *  3. Assert the unit's line is the earlier declaration either way.
 */
func TestMergedIdentityReportsItsFirstDeclaration(t *testing.T) {
  for name, source := range map[string]string{
    "interface then namespace": `
export interface ISale {
  price: number;
}
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`,
    "namespace then interface": `
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
export interface ISale {
  price: number;
}
`,
    "interface declared twice": `
export interface ISale {
  price: number;
}
export interface ISale {
  discount: number;
}
`,
  } {
    inventory := parseTypeScriptInventory(t, "src/ISale.ts", source)
    found := false
    for _, unit := range inventory.Units {
      if unit.Target != "ISale" {
        continue
      }
      found = true
      if unit.Line != 2 {
        t.Fatalf("%s: merged identity must report its first declaration at line 2, got %d", name, unit.Line)
      }
    }
    if !found {
      t.Fatalf("%s: no unit materialized for the merged identity", name)
    }
  }
}

/**
 * Verifies an overload set reports its first signature.
 *
 * Overload signatures are several declarations of one identity down a different
 * collector branch than declaration merging, so the ordering rule has to hold
 * there too or a callable's diagnostics point at whichever signature happens to
 * be last.
 *
 *  1. Declare two overload signatures and their implementation.
 *  2. Materialize the inventory.
 *  3. Assert the unit's line is the first signature.
 */
func TestOverloadSetReportsItsFirstSignature(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/format.ts", `
export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}
`)
  for _, unit := range inventory.Units {
    if unit.Target == "format" && unit.Line != 2 {
      t.Fatalf("an overload set must report its first signature at line 2, got %d", unit.Line)
    }
  }
}

/**
 * Verifies the reported declaration is stable across repeated scans.
 *
 * The association between an identity and its declarations lives in maps, and a
 * diagnostic whose line drifts between runs is worse than one that is
 * consistently wrong: it makes a failure irreproducible and a baseline
 * unwritable. Repetition is the only way to catch an ordering that happens to
 * be stable in one run.
 *
 *  1. Scan the same merged identity forty times.
 *  2. Collect every line the unit reported.
 *  3. Assert exactly one line was ever produced.
 */
func TestMergedIdentityLineIsStableAcrossScans(t *testing.T) {
  source := `
export interface ISale {
  price: number;
}
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`
  lines := map[int]bool{}
  for attempt := 0; attempt < 40; attempt++ {
    inventory := parseTypeScriptInventory(t, "src/ISale.ts", source)
    for _, unit := range inventory.Units {
      if unit.Target == "ISale" {
        lines[unit.Line] = true
      }
    }
  }
  if len(lines) != 1 || !lines[2] {
    t.Fatalf("a merged identity's reported line must be stable at 2, got %v", lines)
  }
}

/**
 * Verifies an obligation names the first declaration in its diagnostic.
 *
 * The unit tests above read the inventory directly; this reads what a user
 * sees. A missing acknowledgement sends its reader to a line, and that line has
 * to be the identity's first declaration no matter which half was written
 * first.
 *
 *  1. Obligate a merged identity from a TypeScript claim, in both orders.
 *  2. Leave it unacknowledged.
 *  3. Assert the diagnostic points at line 2 either way.
 */
func TestMissingAcknowledgementNamesTheFirstDeclaration(t *testing.T) {
  for name, source := range map[string]string{
    "interface first": `
export interface ISale {
  price: number;
}
export namespace ISale {
  export const version: string = "1";
}
`,
    "namespace first": `
export namespace ISale {
  export const version: string = "1";
}
export interface ISale {
  price: number;
}
`,
  } {
    messages := runIndexRule(t, map[string]string{
      "src/claim.ts":   "export interface IClaim {}\n",
      "src/subject.ts": source,
    }, mergedIdentityReferenceConfig)
    assertProblemContains(t, messages, "Missing acknowledgement for 'ISale'")
    if countProblemsContaining(messages, "at src/subject.ts:2)") == 0 {
      t.Fatalf("%s: the obligation must name the first declaration's line", name)
    }
  }
}

/**
 * Verifies a citation is accepted on either declaration of a merged identity.
 *
 * The graph judges the relation on the identity, not on the declaration that
 * happens to carry the tag, so both placements resolve and both discharge the
 * obligation. This is the property that lets the rule stay silent about
 * placement instead of policing it with a diagnostic of its own, and it was
 * never asserted.
 *
 *  1. Cite the same section from the first declaration, then from the second.
 *  2. Run the graph over a claim owing that section.
 *  3. Assert both are silent.
 */
func TestCitationIsAcceptedOnEitherMergedDeclaration(t *testing.T) {
  for name, source := range map[string]string{
    "on the first declaration": `
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export interface ISale {
  price: number;
}
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`,
    "on the second declaration": `
export interface ISale {
  price: number;
}
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`,
  } {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Sale Price {#sale-price}\n",
      "src/ISale.ts": source,
    }, mergedIdentityGraphConfig)
    if len(messages) != 0 {
      t.Fatalf("%s: a citation must be accepted wherever it sits on a merged identity, got:\n%v", name, messages)
    }
  }
}

/**
 * Verifies both halves may carry a citation without colliding.
 *
 * Two tags for one identity are independent acknowledgements of two different
 * targets. A positive duplicate requires the same resolved scope on the same
 * declaration host, so reporting either tag would make the graph disagree with
 * itself about what one identity is allowed to say.
 *
 *  1. Cite one section from each half of a merged identity.
 *  2. Run the graph over a claim owing both sections.
 *  3. Assert silence.
 */
func TestBothMergedDeclarationsMayCarryCitations(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Sale Price {#sale-price}\n\n## Discount {#discount}\n",
    "src/ISale.ts": `
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export interface ISale {
  price: number;
}
/** @evidence docs/spec.md#discount The companion mirrors the discount rule. */
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`,
  }, mergedIdentityGraphConfig)
  assertNoProblems(t, messages)
}

/**
 * Verifies host eligibility does not depend on which half carries the tag.
 *
 * A claim selecting only `type` hosts must accept a citation from either
 * declaration, since both an interface and a namespace are type hosts. If the
 * halves offered different host kinds, the same citation would be in or out of
 * scope depending on where it was written.
 *
 *  1. Select only `type` hosts.
 *  2. Cite from each half in turn.
 *  3. Assert neither is reported as an out-of-scope host.
 */
func TestHostEligibilityIsIdenticalAcrossMergedDeclarations(t *testing.T) {
  for name, source := range map[string]string{
    "interface host": `
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export interface ISale {
  price: number;
}
export namespace ISale {
  export const version: string = "1";
}
`,
    "namespace host": `
export interface ISale {
  price: number;
}
/** @evidence docs/spec.md#sale-price The companion mirrors this pricing rule. */
export namespace ISale {
  export const version: string = "1";
}
`,
  } {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Sale Price {#sale-price}\n",
      "src/ISale.ts": source,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/**"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }]}`)
    if countProblemsContaining(messages, "Out-of-scope") != 0 {
      t.Fatalf("%s: both halves of a merge are type hosts, got:\n%v", name, messages)
    }
  }
}

/**
 * Verifies a class beside a namespace is one unit reported from the class.
 *
 * Both halves are type units under one identity, and TypeScript refuses the
 * reverse order (`TS2434`, "A namespace declaration cannot be located prior to
 * a class or function with which it is merged"), so the class is always the
 * declaration the merge reports. The namespace keeps its own members, because a
 * companion namespace beside a class is authored contract rather than the
 * static-side machinery a function-merged namespace holds.
 *
 *  1. Declare a class and a namespace of one name.
 *  2. Materialize the inventory.
 *  3. Assert the type unit reports the class, and both halves contribute.
 */
func TestClassBesideNamespaceIsOneGraphUnitFromTheClass(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  price(): number {
    return 0;
  }
}
export namespace Sale {
  export const version: string = "1";
}
`)
  targets := map[string]int{}
  for _, unit := range inventory.Units {
    targets[unit.Symbol+":"+unit.Target] = unit.Line
  }
  if line, exists := targets["type:Sale"]; !exists || line != 2 {
    t.Fatalf("the type unit 'Sale' must be the class at line 2, got %d (exists=%v)", line, exists)
  }
  if _, exists := targets["function:Sale.prototype.price"]; !exists {
    t.Fatalf("the class must contribute its method as a separate unit, got %v", targets)
  }
  if _, exists := targets["property:Sale.version"]; !exists {
    t.Fatalf("the merged namespace must keep contributing its member, got %v", targets)
  }
}
