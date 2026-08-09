package evidence

import "testing"

// refusedHostConfig is one claim selecting `symbol`, citing one Markdown H2.
//
// Every case in this file asserts the same pair: the citation is refused as an
// out-of-scope host, and the section it named stays unacknowledged. The second
// half is what keeps the first from passing on a claim that never ran, since a
// refusal and a deactivated claim both leave the tag uncounted.
func refusedHostConfig(symbol string) string {
  return `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"` + symbol + `",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`
}

// assertHostRefused runs one source against one selector and pins both halves.
//
// Every fixture carries an uncited declaration of the selected kind. Without one
// the claim has no selected host, `claimIsInactive` drops it before evaluation,
// and the run is silent for a reason that has nothing to do with the refusal
// under test.
//
// `kind` is the host set the refused declaration really registers, and asserting
// it is what makes a row measure a registration rather than a rejection.
// Matching the selector half alone left every row green when the diagnostic was
// made to name a kind the declaration does not have, which is exactly the answer
// an over-broad registration produces.
func assertHostRefused(t *testing.T, source string, symbol string, kind string) {
  t.Helper()
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Contract {#contract}\n",
    "src/contracts.ts": source,
  }, refusedHostConfig(symbol))
  assertProblemContains(
    t,
    messages,
    "host kind '"+kind+"' is not selected ("+symbol+")",
  )
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
}

const refusedInterfaceSource = `
/** @evidence docs/spec.md#contract An interface is not a callable. */
export interface ISale {
  price: number;
}
export function activate(): void {}
`

/**
 * Verifies an interface hosts a citation for `type` and for nothing else.
 *
 * `addTypeScriptHost` registers one kind per declaration, and the registration
 * is the only thing standing between a claim's selector and a tag it was
 * written to exclude. An over-broad registration does not error: it accepts the
 * tag and discharges a reference, so a project that narrowed `symbol`
 * deliberately would have that narrowing quietly stop applying. Adding
 * `"function"` to the interface was a one-line edit the whole suite tolerated.
 *
 *  1. Cite a Markdown section from an exported interface.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestInterfaceIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedInterfaceSource, "function", "type")
}

/**
 * Verifies an interface does not host a property claim either.
 *
 * The twin of the case above on the other selector. An interface declares
 * property members, so `"property"` is the registration a reader is most likely
 * to assume belongs on the container rather than on the members, and it was the
 * second one-line edit the suite tolerated.
 *
 *  1. Cite the same section from the same interface.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestInterfaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedInterfaceSource, "property", "type")
}

const refusedTypeAliasSource = `
/** @evidence docs/spec.md#contract A type alias is not a callable. */
export type TSale = {
  price: number;
};
export function activate(): void {}
`

/**
 * Verifies an object-shaped type alias hosts a citation for `type` alone.
 *
 * The alias is the container whose members classify by the same rule as an
 * interface's, so a registration meant for a member is as easy to write here,
 * and nothing noticed either spelling.
 *
 *  1. Cite a Markdown section from an exported object-shaped type alias.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestTypeAliasIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedTypeAliasSource, "function", "type")
}

/**
 * Verifies an object-shaped type alias does not host a property claim.
 *
 * The other selector, and the likelier mistake of the two: an alias whose whole
 * body is property members reads as a property host to anyone writing the
 * registration from what the declaration contains rather than from what it is.
 *
 *  1. Cite the same section from the same alias.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestTypeAliasIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedTypeAliasSource, "property", "type")
}

const refusedNamespaceSource = `
/** @evidence docs/spec.md#contract A namespace is not a callable. */
export namespace Orders {
  export interface Input {
    id: string;
  }
}
export function activate(): void {}
`

/**
 * Verifies a namespace hosts a citation for `type` alone.
 *
 * A namespace contains callables and data, so its own registration is the one
 * most likely to be widened to whatever it holds. Nothing inside it is
 * callable, so the activating declaration for this row sits outside it.
 *
 *  1. Cite a Markdown section from an exported namespace.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestNamespaceIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedNamespaceSource, "function", "type")
}

/**
 * Verifies a namespace does not host a property claim either.
 *
 * The namespace is the only container that holds every kind at once, so both of
 * its wrong selectors have to be refused rather than one standing for the
 * other. What activates this row is the nested member `Orders.Input.id` rather
 * than the declaration outside the namespace, so removing that member silences
 * the row instead of changing what it asserts.
 *
 *  1. Cite the same section from the same namespace.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestNamespaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedNamespaceSource, "property", "type")
}

/**
 * Verifies a variable statement wrapper hosts no type claim.
 *
 * A variable registers two host positions and each needs its own row, because a
 * tag reaches exactly one of them. TypeScript attaches a leading block to the
 * statement, so this is the position an ordinary citation consults.
 *
 *  1. Cite a Markdown section from an exported `const`.
 *  2. Evaluate a `symbol: "type"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestModuleVariableStatementIsNotATypeHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A variable is not a type. */
export const limit = 1;
export interface IActivate {
  id: string;
}
`, "type", "property")
}

/**
 * Verifies a variable declarator hosts no type claim either.
 *
 * The other position, and the one the case above cannot reach: a block above
 * the statement is the statement's, so an over-registration on the declarator
 * stayed invisible however many statement-level citations the suite wrote. A
 * tag on an inner declarator is what consults it.
 *
 *  1. Cite a Markdown section from the second declarator of a statement.
 *  2. Evaluate a `symbol: "type"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestModuleVariableDeclaratorIsNotATypeHost(t *testing.T) {
  assertHostRefused(t, `
export const alpha = 1,
  /** @evidence docs/spec.md#contract A declarator is not a type. */
  beta = 2;
export interface IActivate {
  id: string;
}
`, "type", "property")
}

/**
 * Verifies a dotted namespace hosts a citation for `type` alone.
 *
 * `export namespace Outer.Inner {}` is parsed as nested module declarations and
 * resolves through the same registration the module-scope rows use, so what it
 * pins is that the outer declaration is still registered when a dotted form
 * flows through that branch: narrowing the branch to skip a nested body reddens
 * these two rows and no others. The inner registration is unreachable by any
 * citation, because TypeScript attaches a leading block to the outer
 * declaration, so it gets no row.
 *
 *  1. Cite a Markdown section from a dotted namespace.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestDottedNamespaceIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A dotted namespace is not a callable. */
export namespace Outer.Inner {
  export interface Input {
    id: string;
  }
}
export function activate(): void {}
`, "function", "type")
}

/**
 * Verifies a dotted namespace does not host a property claim either.
 *
 * Both of its wrong selectors are refused for the reason the module-scope
 * namespace has two rows: it is the container that holds every kind at once.
 *
 *  1. Cite the same section from the same dotted namespace.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestDottedNamespaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A dotted namespace is not a property. */
export namespace Outer.Inner {
  export interface Input {
    id: string;
  }
}
export const activate = 1;
`, "property", "type")
}

/**
 * Verifies a function-valued variable hosts no property claim.
 *
 * The variable rows above pin the `type` axis on both positions and say nothing
 * about the two kinds a variable really registers. A `const` initialized with a
 * function registers `function`, so a `property` claim must refuse it, and the
 * data `const` beside it is what makes that claim active at all.
 *
 *  1. Cite a Markdown section from a function-valued `const`.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestCallableVariableIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A callable variable is not a property. */
export const parse = (): void => {};
export const limit = 1;
`, "property", "function")
}

/**
 * Verifies a class field hosts no function claim.
 *
 * A class member registers exactly the kind `memberSymbol` gave it, and both
 * kinds share one registration site, so an over-broad one there reaches every
 * member of every class at once. The method beside the field activates the
 * claim and is the member the selector legitimately owns, so the row states the
 * boundary between them rather than the absence of both.
 *
 *  1. Cite a Markdown section from a public class field.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestClassFieldIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, `
export class Sale {
  /** @evidence docs/spec.md#contract A field is not a callable. */
  readonly price: number = 0;
  charge(): void {}
}
`, "function", "property")
}

/**
 * Verifies an interface method signature hosts no property claim.
 *
 * The member half of the interface, which the container rows above do not
 * reach: members register at their own site, and a method signature is a
 * `function` there, so a `property` claim must refuse it. The data member
 * beside it activates the claim and is the one the selector owns.
 *
 *  1. Cite a Markdown section from an interface method signature.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestInterfaceMethodSignatureIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
export interface ISale {
  /** @evidence docs/spec.md#contract A method signature is not a property. */
  run(): void;
  label: string;
}
`, "property", "function")
}

/**
 * Verifies a callable declarator hosts no property claim.
 *
 * The declarator's other axis, and the one the statement row cannot reach. A
 * declarator chooses `property` or `function` from its own initializer, so a
 * statement-level citation lands on the wrapper and says nothing about which
 * kind the declarator registered. The tag goes on the inner declarator for that
 * reason, and the data declarator beside it activates the claim.
 *
 *  1. Cite a Markdown section from a function-valued inner declarator.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestCallableDeclaratorIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
export const alpha = 1,
  /** @evidence docs/spec.md#contract A callable declarator is not a property. */
  beta = (): void => {};
`, "property", "function")
}
