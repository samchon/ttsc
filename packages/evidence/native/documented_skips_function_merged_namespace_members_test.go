package evidence

import (
  "testing"
)

/**
 * Verifies `evidence/documented` sees the same corrected population.
 *
 * The correction belongs to the unit collection every rule shares, not to the
 * graph rule alone. If it did not reach here, a consumer selecting function
 * hosts would still be told to write a JSDoc block on `get.path`, `get.random`,
 * and `get.simulate` , declarations that are no longer part of the public
 * surface at all.
 *
 *  1. Document the accessor and leave its static members bare.
 *  2. Run the documented rule over function hosts.
 *  3. Assert silence, then assert the rule still fires on an ordinary
 *     namespace's undocumented member.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises the authored fixture. Assert silence, then assert the rule still fires on an ordinary namespace's undocumented member.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The correction belongs to the unit collection every rule shares, not to the graph rule alone. If it did not reach here, a consumer selecting function hosts would still be told to write a JSDoc block on `get.path`, `get.random`, and `get.simulate` , declarations that are no longer part of the public surface at all. The authored scenario requires this outcome: Assert silence, then assert the rule still fires on an ordinary namespace's undocumented member.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Document the accessor and leave its static members bare. Run the documented rule over function hosts. Assert silence, then assert the rule still fires on an ordinary namespace's undocumented member.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedSkipsFunctionMergedNamespaceMembers runs as a Go unit entry in the native package. runDocumentedRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
