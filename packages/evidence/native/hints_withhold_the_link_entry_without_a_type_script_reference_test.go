package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the inline-link entry is withheld when nothing cites TypeScript.
 *
 * A graph citing only Markdown cannot resolve an inline-link target, so
 * offering the grammar there hands the author an unresolved-target diagnostic
 * for taking a suggestion. The entry is a projection of the configuration, not
 * a constant.
 *
 *  1. Satisfy a graph whose only reference is Markdown.
 *  2. Take the published corpus.
 *  3. Assert no entry inserts the opener.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints evaluates a passing Markdown-only graph and rejects every insert beginning with {@link.
 * @evidence contracts/testing.md#independent-expectations A Markdown-only reference population cannot resolve TypeScript inline-link targets, so no opener should be offered. The forbidden prefix is literal rather than inferred from returned inserts.
 * @evidence contracts/testing.md#distinguishing-cases The passing Markdown-only graph is the negative twin of TestHintsRouteIntoTypeScriptCompletion; it checks all hints rather than only the first entry.
 * @evidence contracts/testing.md#execution-ownership TestHintsWithholdTheLinkEntryWithoutATypeScriptReference is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsWithholdTheLinkEntryWithoutATypeScriptReference(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  for _, hint := range hints {
    if strings.HasPrefix(hint.Insert, "{@link") {
      t.Fatalf("the inline-link entry must be withheld, got %q", hint.Insert)
    }
  }
}
