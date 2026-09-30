package evidence

import (
  "testing"
)

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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Overload signatures are separate FunctionDeclaration nodes sharing a name, so a per-declaration counter reports a three-signature function as three identities. The authored scenario requires this outcome: Assert silence.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare two overload signatures and their implementation. Run the rule against a file named after the function. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularCountsFunctionOverloadsOnce runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
