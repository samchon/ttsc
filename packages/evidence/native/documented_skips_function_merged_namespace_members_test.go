package evidence

import (
  "testing"
)

/**
 * Verifies `evidence/documented` sees the same corrected population.
 *
 * The correction belongs to the unit collection every rule shares, not to the
 * graph rule alone. If it did not reach here, a consumer selecting function
 * hosts would still be told to write a JSDoc block on `get.path` and
 * `get.simulate`, declarations that are no longer part of the public surface at
 * all.
 *
 *  1. Document the accessor and leave its static members bare.
 *  2. Run the documented rule over function hosts.
 *  3. Assert silence, then assert the rule still fires on an ordinary
 *     namespace's undocumented member.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with `{"symbol":["function"]}`: over a documented `function get` merged with a namespace whose `path` and `simulate` consts are undocumented assertSilent requires no diagnostics, and over a plain `namespace health` with an undocumented `probe` arrow const assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'health.probe'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the shared unit-collection contract: namespace members merged with a function are the function's static side and are not public units, so the documented rule must not demand blocks on them, while an ordinary namespace's callable member still is demanded.
 * @evidence contracts/testing.md#distinguishing-cases The function-merged namespace (silent) against an ordinary namespace (reported) under the same function selection; the second assertion keeps the first from being satisfied by a rule that reports nothing.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSkipsFunctionMergedNamespaceMembers is a Go unit entry in the native test process; runDocumentedRule parses each source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedSkipsFunctionMergedNamespaceMembers(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/health.ts", `
/** Returns the process health marker. */
export function get(connection: string): string {
  return get.simulate(connection);
}
export namespace get {
  export const path = () => "/health";
  export const simulate = (_connection: string): string => "true";
}
`, `{"symbol":["function"]}`))

  assertReported(t, runDocumentedRule(t, "src/health.ts", `
export namespace health {
  export const probe = (): void => {};
}
`, `{"symbol":["function"]}`), "Missing JSDoc on exported function 'health.probe'")
}
