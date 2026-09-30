package evidence

import "testing"

/**
 * Verifies finite and cyclic export paths participate in one ambiguity check.
 *
 * A finite population index can expose one binding while a second binding at
 * the same address requires following a namespace back to an active module.
 *
 * 1. Publish two namespace bindings through separate star re-exports.
 * 2. Cite their shared address from Markdown and existing TypeScript inline tags.
 * 3. Reject distinct declarations and deduplicate paths to one declaration.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies finite and cyclic export paths participate in one ambiguity check.
 *
 * @evidence contracts/testing.md#independent-expectations Two different authored declarations at ns.value remain ambiguous; re-exporting the same declaration deduplicates it, for both file-qualified and inline citation forms.
 *
 * @evidence contracts/testing.md#distinguishing-cases Publish two namespace bindings through separate star re-exports. Cite their shared address from Markdown and existing TypeScript inline tags. Reject distinct declarations and deduplicate paths to one declaration.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksUnionCyclicExportCandidates is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksUnionCyclicExportCandidates(t *testing.T) {
  for _, same := range []bool{false, true} {
    for _, inline := range []bool{false, true} {
      name := "distinct"
      other := "export const value = 2;"
      if same {
        name, other = "same", "export { value } from './index';"
      }
      host, content := "review.md", "## Review\n<!-- @link api/index.ts#ns.value Reads the value. -->\n"
      claim := `{"type":"markdown","files":["review.md"],"symbol":"h2",`
      if inline {
        name += "_inline"
        host, content = "review.ts", "import type * as api from './api/index';\n/** @evidence {@link api.ns.value} Reads the value. */\nexport interface Review {}"
        claim = `{"type":"typescript","files":["review.ts"],"symbol":"type",`
      }
      t.Run(name, func(t *testing.T) {
        fixture := newFileLinkFixture(t, map[string]string{
          "api/index.ts": "export const value = 1; export * from './a'; export * from './b';",
          "api/a.ts":     "export * as ns from './index';",
          "api/b.ts":     "export * as ns from './other';",
          "api/other.ts": other,
          host:           content,
        }, `{"claims":[`+claim+`"reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
        if inline {
          fixture.sources = append(fixture.sources, fixture.source(host, content))
        }
        messages := fixture.check()
        if same {
          assertNoProblems(t, messages)
        } else {
          expected := "Ambiguous file-qualified evidence target"
          if inline {
            expected = "Ambiguous evidence target"
          }
          assertProblemContains(t, messages, expected)
          assertProblemContains(t, messages, "Missing acknowledgement")
        }
      })
    }
  }
}
