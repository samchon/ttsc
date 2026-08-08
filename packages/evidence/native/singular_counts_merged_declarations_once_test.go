package evidence

import "testing"

/**
 * Verifies identity counting: a merged interface and namespace of one name stay
 * one identity.
 *
 * This is the form the rule exists to permit. A rule that counted exports would
 * report the everyday `interface` plus `namespace` idiom as two, which is why
 * the counted unit is an identity and why this case, not the single-declaration
 * one, is the anchor of the design.
 *
 *  1. Declare an interface and a namespace of the same exported name.
 *  2. Run the rule against a file named after them.
 *  3. Assert silence.
 */
func TestSingularCountsMergedInterfaceAndNamespaceOnce(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/ISomething.ts", `
export interface ISomething {
  id: string;
}
export namespace ISomething {
  export interface ICreate {
    id: string;
  }
}
`))
}

/**
 * Verifies identity counting across declaration spaces: a class merged with a
 * namespace of the same name is one identity.
 *
 * A class occupies both the type and value space, so a counter keyed on
 * declaration kind rather than on name would double it the moment a namespace
 * joins.
 *
 *  1. Declare an exported class and its companion namespace.
 *  2. Run the rule against a file named after them.
 *  3. Assert silence.
 */
func TestSingularCountsMergedClassAndNamespaceOnce(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/Something.ts", `
export class Something {}
export namespace Something {
  export const version: string = "1";
}
`))
}

/**
 * Verifies identity counting through a default alias: a default export of a
 * local declaration adds no second identity.
 *
 * `export default something` exposes the name `default`, which names no
 * identity. Counting public names rather than identities would report this
 * file, and the plugin's own entry point uses exactly this shape.
 *
 *  1. Export a const and default-export the same binding.
 *  2. Run the rule against a file named after the const.
 *  3. Assert silence.
 */
func TestSingularCountsDefaultAliasOfLocalDeclarationOnce(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/evidence.ts", `
export const evidence = { name: "evidence" };
export default evidence;
`))
}

/**
 * Verifies identity counting across overloads: several signatures of one
 * function are one identity.
 *
 * Overload signatures are separate FunctionDeclaration nodes sharing a name, so
 * a per-declaration counter reports a three-signature function as three
 * identities.
 *
 *  1. Declare two overload signatures and their implementation.
 *  2. Run the rule against a file named after the function.
 *  3. Assert silence.
 */
func TestSingularCountsFunctionOverloadsOnce(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/format.ts", `
export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}
`))
}

/**
 * Verifies the counting rule fires: two unrelated identities in one file are
 * reported once, naming both.
 *
 * The merged-declaration cases above prove the rule stays quiet; without this
 * twin they would equally be satisfied by a rule that never fires at all.
 *
 *  1. Export two unrelated constants.
 *  2. Run the rule.
 *  3. Assert one diagnostic naming both identities.
 */
func TestSingularReportsTwoUnrelatedIdentities(t *testing.T) {
  messages := runSingularRule(t, "src/alpha.ts", `
export const alpha = 1;
export const beta = 2;
`)
  assertReported(t, messages, "declares exactly one public identity")
  assertReported(t, messages, "'alpha' (line 2)")
  assertReported(t, messages, "'beta' (line 3)")
}

/**
 * Verifies the counting rule sees separate bindings of one statement.
 *
 * A single `export const a = 1, b = 2;` declares two identities behind one
 * statement node, so a walker that stopped at the statement would miss the
 * second.
 *
 *  1. Export two bindings from one variable statement.
 *  2. Run the rule.
 *  3. Assert both are named.
 */
func TestSingularReportsSeparateBindingsOfOneStatement(t *testing.T) {
  messages := runSingularRule(t, "src/pair.ts", `
export const first = 1, second = 2;
`)
  assertReported(t, messages, "'first' (line 2), 'second' (line 2)")
}

/**
 * Verifies the counting rule covers a declaration the evidence graph does not
 * materialize as a unit at all.
 *
 * An enum is deliberately not a unit for `evidence/graph`, so a rule reusing
 * that classification would let an exported enum share a file with anything.
 * This rule counts public identities, not evidence units, and the class beside
 * the enum is the control: it counts here for the same reason, independently of
 * being a type unit.
 *
 *  1. Export a class and an enum.
 *  2. Run the rule.
 *  3. Assert both count.
 */
func TestSingularCountsClassesAndEnums(t *testing.T) {
  messages := runSingularRule(t, "src/Service.ts", `
export class Service {}
export enum Mode {
  Fast = "fast",
}
`)
  assertReported(t, messages, "'Mode' (line 3)")
}
