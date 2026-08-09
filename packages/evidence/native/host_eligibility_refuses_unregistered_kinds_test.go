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
func assertHostRefused(t *testing.T, source string, symbol string) {
  t.Helper()
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Contract {#contract}\n",
    "src/contracts.ts": source,
  }, refusedHostConfig(symbol))
  assertProblemContains(t, messages, "is not selected ("+symbol+")")
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
  assertHostRefused(t, refusedInterfaceSource, "function")
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
  assertHostRefused(t, refusedInterfaceSource, "property")
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
  assertHostRefused(t, refusedTypeAliasSource, "function")
}

/**
 * Verifies an object-shaped type alias does not host a property claim.
 *
 *  1. Cite the same section from the same alias.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestTypeAliasIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedTypeAliasSource, "property")
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
 * most likely to be widened to whatever it holds. It holds only a nested type
 * here, so nothing else in the file could satisfy the selector and mask the
 * refusal.
 *
 *  1. Cite a Markdown section from an exported namespace.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestNamespaceIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedNamespaceSource, "function")
}

/**
 * Verifies a namespace does not host a property claim either.
 *
 *  1. Cite the same section from the same namespace.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestNamespaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedNamespaceSource, "property")
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
`, "type")
}

/**
 * Verifies a variable declarator hosts no type claim either.
 *
 * The other position, and the one the case above cannot reach: a block above
 * the statement is the statement's, so an over-registration on the declarator
 * stayed invisible however many statement-level citations the suite wrote. A
 * tag on an inner declarator is what consults it, and that only resolves to a
 * host at all because the declarator is now recorded against its unit.
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
`, "type")
}
