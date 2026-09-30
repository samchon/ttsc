package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies conflicting scopes remain an error: a child exclusion cannot hide
 * inside a parent evidence acknowledgement.
 *
 * Evidence and exclusion express opposite intent even though both discharge an
 * obligation. Allowing their overlap as an idempotent set union would erase the
 * contradiction from review.
 *
 *  1. Acknowledge a complete Markdown file.
 *  2. Exclude one H2 subtree in a second declaration.
 *  3. Assert the overlap produces one conflict diagnostic.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule cites the complete Markdown file and excludes its Create section on the same interface, requiring one conflict.
 * @evidence contracts/testing.md#independent-expectations Aggregate positive scope and negative child scope contradict one another even though both discharge selected units.
 * @evidence contracts/testing.md#distinguishing-cases File versus H2 hierarchy detects missed ancestor intersection; this entry checks conflict count, not the full diagnostic set or missing-coverage count.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceAndExclusionScopesConflictOnce is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestEvidenceAndExclusionScopesConflictOnce(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Create
### Validate
`,
    "src/ref.ts": `
/**
 * @evidence docs/spec.md The implementation follows the complete specification.
 * @evidenceExclude docs/spec.md#create Creation is supposedly excluded.
 */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":["h2","h3"]}
  }]}`)
  if got := countProblemsContaining(messages, "Conflicting acknowledgements"); got != 1 {
    t.Fatalf("overlapping scopes produced %d conflict findings:\n%s", got, strings.Join(messages, "\n"))
  }
}
