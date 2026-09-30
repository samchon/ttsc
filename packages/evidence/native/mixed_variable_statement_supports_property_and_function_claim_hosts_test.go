package evidence

import (
  "testing"
)

/**
 * Verifies mixed variable statements expose every resident host kind.
 *
 * TypeScript attaches one leading JSDoc block to the statement around all
 * declarators. Choosing only the first discovered kind would make the same
 * source legal under one selector and spuriously out of scope under the other.
 *
 *  1. Put a scalar and callable const in one exported statement.
 *  2. Run the same JSDoc declaration under property-only and function-only claims.
 *  3. Assert both selectors accept the mixed statement host.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert both selectors accept the mixed statement host.
 * @evidence contracts/testing.md#independent-expectations TypeScript attaches one leading JSDoc block to the statement around all declarators. Choosing only the first discovered kind would make the same source legal under one selector and spuriously out of scope under the other. The authored scenario requires this outcome: Assert both selectors accept the mixed statement host.
 * @evidence contracts/testing.md#distinguishing-cases Put a scalar and callable const in one exported statement. Run the same JSDoc declaration under property-only and function-only claims. Assert both selectors accept the mixed statement host.
 * @evidence contracts/testing.md#execution-ownership TestMixedVariableStatementSupportsPropertyAndFunctionClaimHosts runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestMixedVariableStatementSupportsPropertyAndFunctionClaimHosts(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
const source = { state: "ready" };
/** @evidence docs/spec.md#contract The exported statement carries this contract. */
export const { state } = source, run = (): void => {};
`,
  }
  for _, symbol := range []string{"property", "function"} {
    t.Run(symbol, func(t *testing.T) {
      messages := runIndexRule(t, files, `{"claims":[{
        "type":"typescript",
        "files":["src/ref.ts"],
        "symbol":"`+symbol+`",
        "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
      }]}`)
      assertNoProblems(t, messages)
    })
  }
}
