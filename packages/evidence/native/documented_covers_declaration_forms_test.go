package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the overload branch still fires when no signature is documented.
 *
 * Merging the run must not become skipping it, which would exempt every
 * overloaded callable in a project.
 *
 *  1. Leave every signature of an overload set undocumented.
 *  2. Run the rule.
 *  3. Assert exactly one finding for the set.
 */
func TestDocumentedReportsAnUndocumentedOverloadSetOnce(t *testing.T) {
  messages := runDocumentedRule(t, "src/format.ts", `
export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}
`, "")
  if len(messages) != 1 {
    t.Fatalf("expected one finding, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertReported(t, messages, "Missing JSDoc on exported function 'format'")
}

/**
 * Verifies two distinct callables are not merged.
 *
 * The overload run is keyed on the shared name, so adjacent but unrelated
 * functions must stay separate hosts. Merging them would let one block excuse
 * the other.
 *
 *  1. Document the first of two adjacent, differently named functions.
 *  2. Run the rule.
 *  3. Assert the second is still reported.
 */
func TestDocumentedKeepsAdjacentUnrelatedFunctionsSeparate(t *testing.T) {
  messages := runDocumentedRule(t, "src/format.ts", `
/** Renders a value for display. */
export function format(value: string): string {
  return value;
}
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'parse'")
}

/**
 * Verifies public class methods are selected.
 *
 * A public method is a function unit and a claim host, so it belongs to the
 * population that must be able to carry a tag.
 *
 *  1. Leave one public method undocumented on an exported class.
 *  2. Run the rule.
 *  3. Assert the method is reported under its qualified name.
 */
func TestDocumentedSelectsPublicClassMethods(t *testing.T) {
  messages := runDocumentedRule(t, "src/Service.ts", `
/** A service the application exposes. */
export class Service {
  public run(): void {}
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'Service.prototype.run'")
}

/**
 * Verifies public class member variables are selected.
 *
 * A public field is a property unit and a claim host, so it belongs to the
 * population that must be able to carry a tag. Its twin above covers the
 * callable half; without this one a field could quietly leave the population
 * while the suite stayed green.
 *
 *  1. Leave one public field undocumented on an exported class.
 *  2. Run the rule.
 *  3. Assert the field is reported under its qualified name.
 */
func TestDocumentedSelectsPublicClassFields(t *testing.T) {
  messages := runDocumentedRule(t, "src/Service.ts", `
/** A service the application exposes. */
export class Service {
  public readonly retries: number = 3;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported property 'Service.prototype.retries'")
}

/**
 * Verifies a parameter property needs its own block, and an idiomatic `@param`
 * on the constructor does not stand in for it.
 *
 * This is the one place the rule asks for something a well-documented codebase
 * may not already have, so it is pinned rather than discovered. It is also
 * forced: a constructor's block cannot host a citation for a parameter
 * property, because two of them would leave `@evidence` no way to say which
 * field it means. A field documented only through `@param` therefore genuinely
 * cannot cite anything, which is exactly the silence this rule removes.
 *
 *  1. Document a constructor with `@param` and leave its parameter bare.
 *  2. Run the rule, then run it again with the block moved onto the parameter.
 *  3. Assert the first is reported and the second is silent.
 */
func TestDocumentedDemandsABlockOnAParameterProperty(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export class Sale {
  /**
   * Constructs a sale.
   *
   * @param price The amount the customer pays.
   */
  public constructor(public readonly price: number) {}
}
`, ""), "Missing JSDoc on exported property 'Sale.prototype.price'")

  assertSilent(t, runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export class Sale {
  public constructor(
    /** The amount the customer pays. */
    public readonly price: number,
  ) {}
}
`, ""))
}

/**
 * Verifies private and protected members are exempt.
 *
 * They are not part of the public contract, so they are not claim hosts, and
 * demanding blocks on them would make the rule about style rather than about
 * whether a citation can exist.
 *
 *  1. Leave private and protected members undocumented.
 *  2. Run the rule.
 *  3. Assert silence.
 */
func TestDocumentedIgnoresNonPublicClassMembers(t *testing.T) {
  // The undocumented public member is the control. Asserting silence over
  // non-public members alone would pass just as well if class members had
  // stopped being selected at all, which is the opposite of what this rule
  // guarantees, so the case demands that exactly the public one is reported.
  assertReported(t, runDocumentedRule(t, "src/Service.ts", `
/** A service the application exposes. */
export class Service {
  private cache(): void {}
  protected reset(): void {}
  #secret: number = 1;
  public run(): void {}
}
`, ""), "Missing JSDoc on exported function 'Service.prototype.run'")
}

/**
 * Verifies a class declaration is itself required to be documented and an enum
 * is not.
 *
 * A class is a type unit for `evidence/graph` and an enum is not, so exactly
 * one of the two can be selected as a claim host, and this rule guarantees
 * exactly the population a claim can select. The enum is the twin that keeps
 * the boundary falsifiable: without it, a rule that had started demanding a
 * block on every declaration would look identical here.
 *
 *  1. Export an undocumented class with no members, and an undocumented enum.
 *  2. Run the rule with the default selection.
 *  3. Assert the class alone is reported.
 */
func TestDocumentedSelectsAClassAndIgnoresAnEnum(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Service.ts", `
export class Service {}
export enum Mode {
  Fast = "fast",
}
`, ""), "Missing JSDoc on exported type 'Service'")
}

/**
 * Verifies namespace members are selected.
 *
 * A namespace contains public units of its own, and a member that cannot carry
 * a block cannot cite the evidence its parent's claim obligates.
 *
 *  1. Document a namespace but leave a nested type and a nested const bare.
 *  2. Run the rule.
 *  3. Assert both members are reported.
 */
func TestDocumentedSelectsNamespaceMembers(t *testing.T) {
  messages := runDocumentedRule(t, "src/Orders.ts", `
/** Order contracts. */
export namespace Orders {
  export interface IInput {
    /** Identifier of the order. */
    id: string;
  }
  export const version = "1";
}
`, "")
  assertReportedAmong(t, messages, "Missing JSDoc on exported type 'Orders.IInput'")
  assertReportedAmong(t, messages, "Missing JSDoc on exported property 'Orders.version'")
}

/**
 * Verifies an object-shaped type alias has its properties selected.
 *
 * The graph materializes those properties as units, so they are hosts, and a
 * rule that only walked interfaces would leave the alias form unguarded.
 *
 *  1. Leave one property of an exported type alias undocumented.
 *  2. Run the rule.
 *  3. Assert the property is reported.
 */
func TestDocumentedSelectsTypeAliasProperties(t *testing.T) {
  messages := runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export type Sale = {
  price: number;
};
`, "")
  assertReported(t, messages, "Missing JSDoc on exported property 'Sale.price'")
}

/**
 * Verifies an empty file is silent.
 *
 * The zero case: no statements means no host, and a walker assuming at least
 * one would fault on the emptiest input a project can contain.
 *
 *  1. Parse a file with no statements.
 *  2. Run the rule.
 *  3. Assert silence.
 */
func TestDocumentedAcceptsEmptyFiles(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/blank.ts", "", ""))
}

/**
 * Verifies a re-export needs no block.
 *
 * The declaration lives in another module, where its block belongs. Demanding
 * one here would put documentation on a line that declares nothing.
 *
 *  1. Re-export from other modules and declare nothing.
 *  2. Run the rule.
 *  3. Assert silence.
 */
func TestDocumentedIgnoresReExports(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/index.ts", `
export * from "./alpha";
export { beta } from "./beta";
export type { IDelta } from "./delta";
`, ""))
}

/**
 * Verifies a documented declaration exported through an alias is silent.
 *
 * The block sits on the declaration, while the export list carries the public
 * name. A rule keyed on the export list would find no block and report a
 * documented declaration.
 *
 *  1. Document a local declaration and export it under another name.
 *  2. Run the rule.
 *  3. Assert silence.
 */
func TestDocumentedFindsTheBlockOnAnAliasedDeclaration(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/Other.ts", `
/** The single exported contract. */
interface Local {
  /** Identifier of the contract. */
  id: string;
}
export { Local as Other };
`, ""))
}

/**
 * Verifies the rule reaches an interface's callables and counts an overload
 * run once.
 *
 * These members were invisible to the unit model, so this rule asked nothing of
 * them however public the interface was. They are `function` units now, which
 * means every interface method in every project becomes a declaration this rule
 * demands a block on, with no claim configured anywhere. That is the change's
 * widest consequence and it belongs in a case rather than in a release note.
 *
 * The documented members are what keeps it from passing for the wrong reason: a
 * rule that had simply started reporting the whole interface would name them
 * too, and the exact count would not hold.
 *
 *  1. Document the interface and two of its members, leaving a plain method and
 *     an overload run bare.
 *  2. Run the rule.
 *  3. Assert exactly two findings, one per undocumented identity.
 */
func TestDocumentedReachesInterfaceCallables(t *testing.T) {
  messages := runDocumentedRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** The amount the customer pays. */
  price: number;
  /** Takes the amount. */
  charge: () => void;
  settle(): void;
  refund(amount: string): void;
  refund(amount: number): void;
}
`, "")
  if len(messages) != 2 {
    t.Fatalf("expected two findings, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertReportedAmong(t, messages, "Missing JSDoc on exported function 'ISale.settle'")
  assertReportedAmong(t, messages, "Missing JSDoc on exported function 'ISale.refund'")
}
