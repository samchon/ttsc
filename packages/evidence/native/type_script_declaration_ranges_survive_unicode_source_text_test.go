package evidence

import (
  "testing"
)

/**
 * Verifies non-ASCII source text before JSDoc does not corrupt declaration
 * ranges or evidence parsing.
 *
 * TypeScript AST offsets and Go string slices must use the same coordinate
 * system. If they diverge after multibyte text, the rule slices the wrong bytes
 * and silently loses an otherwise valid declaration.
 *
 *  1. Put Korean text before a JSDoc evidence declaration.
 *  2. Use a Korean reason to exercise the complete comment slice.
 *  3. Assert the selected TypeScript host still acknowledges the source.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the selected TypeScript host still acknowledges the source.
 * @evidence contracts/testing.md#independent-expectations TypeScript AST offsets and Go string slices must use the same coordinate system. If they diverge after multibyte text, the rule slices the wrong bytes and silently loses an otherwise valid declaration. The authored scenario requires this outcome: Assert the selected TypeScript host still acknowledges the source.
 * @evidence contracts/testing.md#distinguishing-cases Put Korean text before a JSDoc evidence declaration. Use a Korean reason to exercise the complete comment slice. Assert the selected TypeScript host still acknowledges the source.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptDeclarationRangesSurviveUnicodeSourceText runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptDeclarationRangesSurviveUnicodeSourceText(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
const 설명 = "다국어 선행 텍스트";

/** @evidence docs/spec.md#contract 이 타입은 문서의 계약을 따른다. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
