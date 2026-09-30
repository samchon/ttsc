package evidence

import (
  "testing"
)

/**
 * Verifies a tag outside every configured population is not reported.
 *
 * A base is a directory and a population is a glob inside it, so a file is
 * scanned whenever it sits under a declared root and belongs to a population
 * only if the glob takes it. Reporting every scanned file made the rule answer
 * for source it does not govern: a stray tag in a consumer's `node_modules`
 * failed their build and named a repair in a file they did not write.
 *
 * The governed file is the negative twin. Confining the report must not silence
 * the population the rule exists for.
 *
 *  1. Write the same unreadable tag inside and outside the claim's glob.
 *  2. Evaluate the claim.
 *  3. Assert only the governed one is reported.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule returns no problems for stray tags in each unselected path, then reports exactly the unreadable citation at line 4 when that text is placed inside src/contracts.ts.
 * @evidence contracts/testing.md#independent-expectations Governance follows configured source globs, not every file under the root. The explicit src/** selector and authored outside paths independently determine which comment belongs to the claim.
 * @evidence contracts/testing.md#distinguishing-cases tools/scratch.ts, node_modules/vendor/index.ts and unrelated/legacy.ts are separate negative subcases; the governed source positive control prevents indiscriminate suppression.
 * @evidence contracts/testing.md#execution-ownership TestATagOutsideEveryPopulationIsNotReported is the Go unit entry discovered beside the native package. runIndexRule evaluates its source and configuration fixtures in the native test process; local loops retain their named subcases without a consumer install or product host.
 */
func TestATagOutsideEveryPopulationIsNotReported(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`
  cited := `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;
`
  stray := `// @evidence docs/spec.md#pricing A tag the graph does not govern.
export const other = 2;
`
  for _, outside := range []string{
    "tools/scratch.ts",
    "node_modules/vendor/index.ts",
    "unrelated/legacy.ts",
  } {
    t.Run(outside, func(t *testing.T) {
      assertNoProblems(t, runIndexRule(t, map[string]string{
        "docs/spec.md":     "## Pricing {#pricing}\n",
        "src/contracts.ts": cited,
        outside:            stray,
      }, config))
    })
  }
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": cited + `
// @evidence docs/spec.md#pricing A tag the graph does govern.
export const other = 2;
`,
  }, config), "Unreadable @evidence at src/contracts.ts:4")
}
