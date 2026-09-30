package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies Markdown section scopes: an H2 exclusion covers only its own
 * selected subtree and leaves the next H2 subtree owed.
 *
 * Heading containment ends at the next heading of equal or higher rank.
 * Treating all later headings as descendants would let one exclusion erase
 * unrelated sibling requirements.
 *
 *  1. Materialize two H2 sections with one H3 child each.
 *  2. Exclude the first H2 scope.
 *  3. Assert only the second H2 and its child remain missing.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule excludes Create and requires exactly two missing findings naming Cancel and Refund, with no missing Validate target.
 * @evidence contracts/testing.md#independent-expectations An H2's scope ends at the next equal-rank heading, so its exclusion covers only Create/Validate.
 * @evidence contracts/testing.md#distinguishing-cases The adjacent Cancel subtree detects a cascade widened to all following headings; exact missing-count and explicit targets distinguish under- and over-coverage.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownHeadingExclusionCoversOnlyItsSubtree is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestMarkdownHeadingExclusionCoversOnlyItsSubtree(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Create
### Validate
## Cancel
### Refund
`,
    "src/ref.ts": `
/** @evidenceExclude docs/spec.md#create This adapter intentionally omits creation. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":["h2","h3"]}
  }]}`)
  if got := countProblemsContaining(messages, "Missing acknowledgement"); got != 2 {
    t.Fatalf("H2 exclusion produced %d missing findings:\n%s", got, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "'docs/spec.md#cancel'")
  assertProblemContains(t, messages, "'docs/spec.md#refund'")
  if strings.Contains(strings.Join(messages, "\n"), "'docs/spec.md#validate'") {
    t.Fatalf("excluded H2 left its H3 child missing:\n%s", strings.Join(messages, "\n"))
  }
}
