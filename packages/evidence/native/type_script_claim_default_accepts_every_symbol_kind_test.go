package evidence

import (
  "testing"
)

/**
 * Verifies TypeScript claim defaults: type, function, and qualified
 * property hosts all accept evidence declarations when symbol is omitted.
 *
 * The claim default is the union of all supported kinds, unlike the source
 * default. This complete graph proves each host can fire rather than trusting a
 * quiet rule with only one declaration shape.
 *
 *  1. Materialize three Markdown headings.
 *  2. Cite them from an interface, function, and interface property.
 *  3. Assert the omitted claim selector accepts every host kind.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the omitted claim selector accepts every host kind.
 * @evidence contracts/testing.md#independent-expectations The claim default is the union of all supported kinds, unlike the source default. This complete graph proves each host can fire rather than trusting a quiet rule with only one declaration shape. The authored scenario requires this outcome: Assert the omitted claim selector accepts every host kind.
 * @evidence contracts/testing.md#distinguishing-cases Materialize three Markdown headings. Cite them from an interface, function, and interface property. Assert the omitted claim selector accepts every host kind.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptClaimDefaultAcceptsEverySymbolKind runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptClaimDefaultAcceptsEverySymbolKind(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Type
## Function
## Property
`,
    "src/ref.ts": `
/** @evidence docs/spec.md#type The type adopts this section. */
export interface Ref {
  /** @evidence docs/spec.md#property The property adopts this section. */
  value: string;
}

/** @evidence docs/spec.md#function The function adopts this section. */
export function execute(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
