package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies Markdown syntax boundaries: heading-shaped text inside fenced code
 * and HTML comments does not become an evidence section.
 *
 * Evidence units follow rendered Markdown structure, not lines that merely
 * begin with hash characters. Both constructs commonly contain examples whose
 * accidental indexing would create obligations no reader can navigate to.
 *
 *  1. Put fake H2 lines inside a code fence and a multiline HTML comment.
 *  2. Put one real H2 after both constructs.
 *  3. Assert only the real heading materializes.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown exercises this case. Verifies Markdown syntax boundaries: heading-shaped text inside fenced code and HTML comments does not become an evidence section.
 *
 * @evidence contracts/testing.md#independent-expectations The literal inventory is file, product, and real. Fenced/commented heading-shaped lines must not add units.
 *
 * @evidence contracts/testing.md#distinguishing-cases Put fake H2 lines inside a code fence and a multiline HTML comment. Put one real H2 after both constructs. Assert only the real heading materializes.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownIgnoresHeadingsInsideCodeAndComments is the selectable Go entry and owns its fixture variants and local closures. It invokes scanProjectMarkdown in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestMarkdownIgnoresHeadingsInsideCodeAndComments(t *testing.T) {
  inventory, problems := scanProjectMarkdown("docs/spec.md", `# Product
`+"```md"+`
## Fenced
`+"```ts"+`
## Still fenced
`+"```"+`
<!--
## Commented
-->
## Real
`)
  if len(problems) != 0 {
    t.Fatalf("unexpected Markdown scan problems: %v", problems)
  }
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Target)
  }
  sort.Strings(targets)
  if got := strings.Join(targets, "\n"); got != strings.Join([]string{
    "docs/spec.md",
    "docs/spec.md#product",
    "docs/spec.md#real",
  }, "\n") {
    t.Fatalf("Markdown syntax boundaries produced:\n%s", got)
  }
}
