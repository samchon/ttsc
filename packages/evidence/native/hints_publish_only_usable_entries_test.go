package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies every published hint carries a scope, trigger boundary, and insert.
 *
 * The host drops a hint with no scope or no `After` rather than offering it
 * everywhere, so a malformed corpus does not fail — it silently shrinks. A
 * count assertion elsewhere would still pass while the entry never reached an
 * editor.
 *
 *  1. Publish a corpus.
 *  2. Inspect every hint's trigger.
 *  3. Assert each carries a scope and an `After` ending where a target begins.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints must publish at least one entry, and every entry must have a nonempty scope and insert plus an After string ending in a space.
 * @evidence contracts/testing.md#independent-expectations The hint envelope requires a scope, insertion text and a trigger ending at the target position. These literal structural requirements are independent of the returned corpus; they do not prove real host admission.
 * @evidence contracts/testing.md#distinguishing-cases Every entry from one passing Markdown graph is inspected. The initial nonempty assertion prevents a vacuous loop, while separate guards identify the malformed field.
 * @evidence contracts/testing.md#execution-ownership TestHintsPublishOnlyUsableEntries is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsPublishOnlyUsableEntries(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  if len(hints) == 0 {
    t.Fatal("expected a corpus")
  }
  for _, hint := range hints {
    if hint.Trigger.Scope == "" {
      t.Fatalf("hint %q carries no scope", hint.Insert)
    }
    if !strings.HasSuffix(hint.Trigger.After, " ") {
      t.Fatalf("trigger %q must end where the target begins", hint.Trigger.After)
    }
    if hint.Insert == "" {
      t.Fatalf("hint at trigger %q inserts nothing", hint.Trigger.After)
    }
  }
}
