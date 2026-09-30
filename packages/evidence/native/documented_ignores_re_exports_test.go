package evidence

import "testing"

/**
 * Verifies a re-export needs no block.
 *
 * The declaration lives in another module, where its block belongs. Demanding
 * one here would put documentation on a line that declares nothing.
 *
 *  1. Re-export from other modules and declare nothing.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a re-export needs no block. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations The declaration lives in another module, where its block belongs. Demanding one here would put documentation on a line that declares nothing. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Re-export from other modules and declare nothing. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedIgnoresReExports is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedIgnoresReExports(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/index.ts", `
export * from "./alpha";
export { beta } from "./beta";
export type { IDelta } from "./delta";
`, ""))
}
