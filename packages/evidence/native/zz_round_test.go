package evidence

import (
  "strings"
  "testing"
)

// The claim selects src/**; the reference is Markdown. No TypeScript population
// selects anything outside src/**.
const roundScopedClaim = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"property",
  "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
}]}`

func TestRoundTagOutsideEveryPopulation(t *testing.T) {
  for _, where := range []string{
    "tools/scratch.ts",
    "node_modules/vendor/index.ts",
    "unrelated/legacy.ts",
  } {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Pricing {#pricing}\n",
      "src/contracts.ts": `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;
`,
      where: `// @evidence docs/spec.md#pricing A tag the graph does not govern.
export const other = 2;
`,
    }, roundScopedClaim)
    t.Logf("%-32s -> %d: %s", where, len(messages), strings.Join(messages, " | "))
  }
}

// A Markdown claim citing Markdown, with a tag written in prose rather than in
// an HTML comment.
const roundMarkdownClaim = `{"claims":[{
  "type":"markdown",
  "files":["docs/claim/**/*.md"],
  "symbol":"h2",
  "reference":{"type":"markdown","files":["docs/spec/**/*.md"],"symbol":"h2"}
}]}`

func TestRoundMarkdownTagOutsideAComment(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec/rules.md": "## Pricing {#pricing}\n",
    "docs/claim/plan.md": "## Plan {#plan}\n\n@evidence docs/spec/rules.md#pricing Written as prose, not in a comment.\n",
  }, roundMarkdownClaim)
  t.Logf("markdown prose tag -> %d: %s", len(messages), strings.Join(messages, " | "))
}

func TestRoundMarkdownTagInACodeFence(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec/rules.md": "## Pricing {#pricing}\n",
    "docs/claim/plan.md": "## Plan {#plan}\n\n<!-- @evidence docs/spec/rules.md#pricing The real citation. -->\n\n```md\n<!-- @evidence docs/spec/rules.md#pricing An example inside a fence. -->\n```\n",
  }, roundMarkdownClaim)
  t.Logf("markdown fenced tag -> %d: %s", len(messages), strings.Join(messages, " | "))
}
