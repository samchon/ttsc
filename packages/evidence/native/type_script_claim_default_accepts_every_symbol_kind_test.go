package evidence

import "testing"

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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies TypeScript claim defaults: type, function, and qualified property hosts all accept evidence declarations when symbol is omitted. The original assertions check assert the omitted claim selector accepts every host kind.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The claim default is the union of all supported kinds, unlike the source default. This complete graph proves each host can fire rather than trusting a quiet rule with only one declaration shape. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Materialize three Markdown headings. Cite them from an interface, function, and interface property. Assert the omitted claim selector accepts every host kind. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptClaimDefaultAcceptsEverySymbolKind is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
