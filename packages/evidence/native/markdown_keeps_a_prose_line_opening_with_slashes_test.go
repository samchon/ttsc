package evidence

import (
  "testing"
)

/**
 * Verifies a `//` line inside Markdown prose still counts as content.
 *
 * The leading-trivia rule belongs to TypeScript, where such a line is trivia the
 * span merely swallowed. In Markdown a line opening with `//` is ordinary prose,
 * and stripping it in the shared normalizer would have deleted real content from
 * the digest of any section that happens to start one that way.
 *
 *  1. Digest a section whose body opens with a `//` line.
 *  2. Change that line's text.
 *  3. Assert the digest moved.
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown retrieves Pricing's digest and requires a change when slash-opening prose changes 30 to 45.
 * @evidence contracts/testing.md#independent-expectations Markdown slash text is content, not TypeScript comment trivia, so its semantic rewrite must affect the digest.
 * @evidence contracts/testing.md#distinguishing-cases The same heading and slash prefix isolate prose content; this entry does not compare ordinary prose normalization or assert an exact hash.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownKeepsAProseLineOpeningWithSlashes is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestMarkdownKeepsAProseLineOpeningWithSlashes(t *testing.T) {
  digestOf := func(content string) string {
    inventory, _ := scanProjectMarkdown("docs/spec.md", content)
    for _, unit := range inventory.Units {
      if unit.Target == "docs/spec.md#pricing" {
        return unit.Digest
      }
    }
    t.Fatalf("expected a unit for the H2 in:\n%s", content)
    return ""
  }
  before := digestOf("## Pricing\n\n// the rate is capped at 30%\n")
  after := digestOf("## Pricing\n\n// the rate is capped at 45%\n")
  if before == after {
    t.Fatal("a Markdown line opening with slashes is missing from the digest")
  }
}
