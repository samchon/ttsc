package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies Markdown declaration hosts obey positive and exclusion cardinality.
 *
 * Markdown has no AST declaration node, so its scanner must preserve heading
 * identity explicitly. Without that identity, same-host positive duplicates
 * disappear or separate headings collapse into one host.
 *
 *  1. Repeat positive evidence across headings and then within one heading.
 *  2. Repeat an exclusion across headings.
 *  3. Assert only the same-host positive and repeated exclusion fail.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies Markdown declaration hosts obey positive and exclusion cardinality. The original assertions check assert only the same-host positive and repeated exclusion fail.
 * @evidence contracts/testing.md#independent-expectations Markdown has no AST declaration node, so its scanner must preserve heading identity explicitly. Without that identity, same-host positive duplicates disappear or separate headings collapse into one host. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Repeat positive evidence across headings and then within one heading. Repeat an exclusion across headings. Assert only the same-host positive and repeated exclusion fail. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownHostsPreserveAcknowledgementCardinality is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestMarkdownHostsPreserveAcknowledgementCardinality(t *testing.T) {
  config := `{"claims":[{
    "type":"markdown",
    "files":["claim.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`
  t.Run("positive across headings", func(t *testing.T) {
    assertNoProblems(t, runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "claim.md": `## First
<!-- @evidence docs/spec.md#contract First implementation. -->
## Second
<!-- @evidence docs/spec.md#contract Second implementation. -->
`,
    }, config))
  })
  t.Run("positive repeated under one heading", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "claim.md": `## First
<!-- @evidence docs/spec.md#contract First reason. -->
<!-- @evidence docs/spec.md#contract Second reason. -->
`,
    }, config)
    assertSingleEvidenceDuplicate(t, messages, "docs/spec.md#contract")
  })
  t.Run("exclusion repeated across headings", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "claim.md": `## First
<!-- @evidenceExclude docs/spec.md#contract First exclusion. -->
## Second
<!-- @evidenceExclude docs/spec.md#contract Second exclusion. -->
`,
    }, config)
    if got := countProblemsContaining(messages, "Duplicate @evidenceExclude"); got != 1 {
      t.Fatalf("Markdown exclusions produced %d duplicates:\n%s", got, strings.Join(messages, "\n"))
    }
  })
}
