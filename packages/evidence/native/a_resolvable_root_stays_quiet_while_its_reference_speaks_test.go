package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a resolvable declared root stays quiet while its reference speaks.
 *
 * Both halves need a declared root to mean anything. A claim with no `root` has
 * the default base, which `baseDirectoryProblem` returns on before it
 * stats anything and which `Check` has already validated, so an absence
 * assertion there could not fail however the new pass behaved. With a declared
 * root that exists, the pass genuinely evaluates it and produces nothing — while
 * the reference-side empty-match diagnostic, which the claim-side removal must
 * not have widened onto, still fires.
 *
 * The root also has to differ from the project root, which resolves as the
 * default base and short-circuits before the stat for that reason alone.
 *
 *  1. Root a claim above the project, where its own source still matches.
 *  2. Point its reference at a path no document occupies.
 *  3. Assert the reference names its globs and the root names nothing.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph reports reference failure without false found-no-directory root diagnostics.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Readable root and independently failing reference fixture fix the two states.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases A healthy root must not invent or absorb a reference failure.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAResolvableRootStaysQuietWhileItsReferenceSpeaks is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestAResolvableRootStaysQuietWhileItsReferenceSpeaks(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/src/sale.ts": "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"..",
    "files":["project/src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "matched no markdown files for ['docs/**']")
  if countProblemsContaining(messages, "found no directory at") != 0 {
    t.Fatalf(
      "a root that exists must not be reported as missing:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
