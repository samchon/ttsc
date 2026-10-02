package evidence

import "testing"

/**
 * Verifies non-exported declarations are never required to be documented.
 *
 * The rule is about the public surface. Demanding a block on every local helper
 * would make the rule unusable in the implementation files it is meant to
 * protect.
 *
 *  1. Declare two undocumented local helpers beside one documented export.
 *  2. Run the rule.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a file with an undocumented local `cache` const and an undocumented local `normalize` function beside one documented exported `parse`; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: only the public surface needs blocks, so local helpers must not be reported.
 * @evidence contracts/testing.md#distinguishing-cases Two kinds of undocumented non-exported declarations (a const and a function) beside a documented export; the exported-and-undocumented report case is owned by a sibling entry, so silence here shows scope rather than a disabled rule.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedIgnoresNonExportedDeclarations is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedIgnoresNonExportedDeclarations(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
const cache = new Map<string, string>();
function normalize(value: string): string {
  return value.trim();
}
/** Normalizes a raw input value. */
export function parse(value: string): string {
  return normalize(value) + cache.size;
}
`, ""))
}
