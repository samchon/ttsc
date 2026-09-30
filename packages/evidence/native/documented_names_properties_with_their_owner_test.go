package evidence

import "testing"

/**
 * Verifies a property is named with its owner.
 *
 * The graph addresses those units as `IAlpha.id` and `IBeta.id`, so a finding
 * naming a bare `id` twice leaves a reader unable to tell the two apart in a
 * build log — and unable to write the citation the diagnostic is asking for.
 *
 *  1. Leave a same-named property undocumented on two interfaces.
 *  2. Run the rule.
 *  3. Assert each finding carries its owner.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a property is named with its owner. The original assertions check assert each finding carries its owner.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The graph addresses those units as `IAlpha.id` and `IBeta.id`, so a finding naming a bare `id` twice leaves a reader unable to tell the two apart in a build log — and unable to write the citation the diagnostic is asking for. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Leave a same-named property undocumented on two interfaces. Run the rule. Assert each finding carries its owner. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedNamesPropertiesWithTheirOwner is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedNamesPropertiesWithTheirOwner(t *testing.T) {
  messages := runDocumentedRule(t, "src/contracts.ts", `
/** First contract. */
export interface IAlpha {
  id: string;
}
/** Second contract. */
export interface IBeta {
  id: string;
}
`, "")
  assertReportedAmong(t, messages, "exported property 'IAlpha.id'")
  assertReportedAmong(t, messages, "exported property 'IBeta.id'")
}
