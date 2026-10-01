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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `export * from "./alpha"`, `export { beta } from "./beta"` and `export type { IDelta } from "./delta"`; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: a re-export declares nothing in this module, so its block belongs where the declaration lives and none may be demanded here.
 * @evidence contracts/testing.md#distinguishing-cases Star, named and type-only re-export forms in one file with no declarations; locally declared undocumented exports are owned by the report entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedIgnoresReExports is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedIgnoresReExports(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/index.ts", `
export * from "./alpha";
export { beta } from "./beta";
export type { IDelta } from "./delta";
`, ""))
}
