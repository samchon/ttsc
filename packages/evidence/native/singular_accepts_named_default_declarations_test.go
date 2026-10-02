package evidence

import (
  "testing"
)

/**
 * Verifies a named default declaration keeps its declared name.
 *
 * `export default function handler() {}` exposes only `default`, but the
 * declaration is named, so the file is the file of `handler`, the negative
 * twin that keeps the anonymous branch from swallowing named declarations.
 *
 *  1. Default-export a named function declaration.
 *  2. Run the rule against a file of that name.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations `export default function handler() {}` exposes only `default`, but the declaration is named, so the file is the file of `handler`, the negative twin that keeps the anonymous branch from swallowing named declarations. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Default-export a named function declaration. Run the rule against a file of that name. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularAcceptsNamedDefaultDeclarations runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularAcceptsNamedDefaultDeclarations(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/handler.ts", `
export default function handler(): void {}
`))
}
