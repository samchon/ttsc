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
