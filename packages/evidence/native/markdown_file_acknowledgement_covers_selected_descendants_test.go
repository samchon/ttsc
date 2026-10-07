package evidence

import (
  "strings"
  "testing"
)

/**
 * TestMarkdownFileAcknowledgementCoversSelectedDescendants
 * Verifies unselected document and namespace scopes cover their selected
 * descendants.
 *
 * A reference selector defines the obligation denominator, not the only
 * addressable scopes. Requiring `"file"` in the selector would make aggregate
 * citation unavailable to the common H2/H3-only population.
 *
 *  1. Select only H2 and H3 units from one document.
 *  2. Cite the unselected file ancestor, then connect a namespace to that
 *     document and a ledger to the namespace's function/property population.
 *  3. Assert both complete graphs are clean, then remove each ancestor
 *     citation separately and require its two named obligations to remain.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule covers four selected Markdown descendants through a file citation and covers a two-claim namespace/ledger graph through unselected document and namespace ancestors. Removing the document citation requires missing Orders/Retry; removing the namespace citation requires missing Implementation.state/run, with exactly two missing findings in each control.
 * @evidence contracts/testing.md#independent-expectations Ancestor scope covers its literal selected descendants even when its own kind is not selected. The separate removal controls name the two authored headings or namespace members; their expected counts are not generated from an observed graph.
 * @evidence contracts/testing.md#distinguishing-cases The original four-heading population remains, while the namespace graph covers both function/property and h2/h3 populations. Each missing-citation control leaves the other citation intact, distinguishing the two edges and detecting a population that shrank or deactivated.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownFileAcknowledgementCoversSelectedDescendants is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestMarkdownFileAcknowledgementCoversSelectedDescendants(t *testing.T) {
  t.Run("document descendants", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": `# Product
## Create
### Validate
## Cancel
### Refund
`,
      "src/ref.ts": `
/** @evidence docs/spec.md The complete implementation follows this specification. */
export interface Ref {}
`,
    }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":["h2","h3"]}
  }]}`)
    assertNoProblems(t, messages)
  })

  files := map[string]string{
    "docs/spec.md": "## Orders\n\n### Retry\n",
    "src/implementation.ts": `/** @evidence docs/spec.md The namespace implements the complete order specification. */
export namespace Implementation {
  export const state = "ready";
  export function run(): void {}
}
`,
    "src/ledger.ts": `import type { Implementation } from "./implementation.js";

/** @evidence {@link Implementation} The ledger documents the complete implementation namespace. */
export interface ILedger {}
`,
  }
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/implementation.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":["h2","h3"]}
  },{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/implementation.ts"],"symbol":["function","property"]}
  }]}`
  t.Run("document and namespace ancestors", func(t *testing.T) {
    assertNoProblems(t, runIndexRule(t, files, config))
  })

  implementation := files["src/implementation.ts"]
  files["src/implementation.ts"] = `export namespace Implementation {
  export const state = "ready";
  export function run(): void {}
}
`
  t.Run("missing document citation", func(t *testing.T) {
    missing := runIndexRule(t, files, config)
    for _, target := range []string{"docs/spec.md#orders", "docs/spec.md#retry"} {
      if !strings.Contains(strings.Join(missing, "\n"), "Missing acknowledgement for '"+target+"'") {
        t.Errorf("missing document obligation %s: %v", target, missing)
      }
    }
    if count := countProblemsContaining(missing, "Missing acknowledgement"); count != 2 {
      t.Errorf("only the two uncited document descendants may be missing, got %d: %v", count, missing)
    }
  })

  files["src/implementation.ts"] = implementation
  files["src/ledger.ts"] = `import type { Implementation } from "./implementation.js";

export interface ILedger {}
`
  t.Run("missing namespace citation", func(t *testing.T) {
    missing := runIndexRule(t, files, config)
    for _, target := range []string{"Implementation.state", "Implementation.run"} {
      if !strings.Contains(strings.Join(missing, "\n"), "Missing acknowledgement for '"+target+"'") {
        t.Errorf("missing namespace obligation %s: %v", target, missing)
      }
    }
    if count := countProblemsContaining(missing, "Missing acknowledgement"); count != 2 {
      t.Errorf("only the two uncited namespace descendants may be missing, got %d: %v", count, missing)
    }
  })
}
