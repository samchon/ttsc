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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over documented interfaces `IAlpha` and `IBeta`, each with an undocumented `id` property; assertReportedAmong requires one diagnostic containing `exported property 'IAlpha.id'` and one containing `exported property 'IBeta.id'`.
 * @evidence contracts/testing.md#independent-expectations The expected names are authored from the addressing contract: the graph addresses these units as `IAlpha.id` and `IBeta.id`, so a finding must carry the owner or the two findings could not be told apart.
 * @evidence contracts/testing.md#distinguishing-cases The same property name on two owners, so a diagnostic naming a bare `id` could not satisfy both assertions; only containment is asserted, so extra diagnostics would not fail the test.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedNamesPropertiesWithTheirOwner is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
