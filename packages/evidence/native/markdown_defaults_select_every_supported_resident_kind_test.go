package evidence

import (
  "testing"
)

/**
 * Verifies Markdown defaults: an omitted source and claim symbol selector
 * covers the file plus every resident H1-H4 unit.
 *
 * A quiet result is meaningful only when every default unit actually had to be
 * acknowledged. The fixture cites the file ancestor once so every resident
 * default unit must participate in its scope.
 *
 *  1. Omit both Markdown symbol selectors.
 *  2. Acknowledge the file containing four heading levels.
 *  3. Assert the complete default graph is green.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies Markdown defaults: an omitted source and claim symbol selector covers the file plus every resident H1-H4 unit.
 *
 * @evidence contracts/testing.md#independent-expectations The omitted selectors select the file and resident H1-H4 headings; the authored file-ancestor citation acknowledges their scope. A clean result alone cannot independently detect an accidentally reduced population.
 *
 * @evidence contracts/testing.md#distinguishing-cases Omit both Markdown symbol selectors. Acknowledge the file containing four heading levels. Assert the complete default graph is green.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownDefaultsSelectEverySupportedResidentKind is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestMarkdownDefaultsSelectEverySupportedResidentKind(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `# Product
## Create
### Validate
#### Persist
`,
    "refs/ledger.md": `<!-- @evidence docs/spec.md The whole specification is adopted. -->
`,
  }, `{"claims":[{
    "type":"markdown",
    "files":["refs/ledger.md"],
    "reference":{"type":"markdown","files":["docs/spec.md"]}
  }]}`)
  assertNoProblems(t, messages)
}
