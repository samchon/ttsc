package evidence

import (
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies an absolute declared root is named in the diagnostic exactly as the
 * author wrote it.
 *
 * The base was resolved and then re-spelled project-relative, so an author who
 * declared `C:/contracts` was handed back an ascending path and told to correct
 * a 'root' property their configuration does not contain. Naming the base at all
 * exists to make a population repairable from the diagnostic alone, and a
 * spelling absent from the file being repaired defeats exactly that.
 *
 *  1. Declare a TypeScript claim rooted at an absolute directory that is absent.
 *  2. Read the root diagnostic.
 *  3. Assert it names the declared spelling and neither restates nor
 *     mis-explains a resolution that never happened.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn runs the graph rule with a TypeScript claim whose root is the absolute, slash-normalized temp `contracts` directory, which is absent; the test requires a message containing `found no directory at the typescript root '<that path>'. Correct the 'root' property` and none containing `which resolves to` or `it resolves against the ttsc project root`.
 * @evidence contracts/testing.md#independent-expectations The expected root text is the path string the test allocated and wrote into the configuration, so the author's spelling is the oracle; the absent clauses follow from the contract that an absolute root lands on itself and has nothing to restate.
 * @evidence contracts/testing.md#distinguishing-cases The absolute-root counterpart of the relative-root case that must keep the resolution clauses; here both resolution sentences must be absent. A root occupied by a file is owned by a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestAnAbsoluteRootIsNamedAsTheAuthorWroteIt is a Go unit entry in the native test process; runRootedGraphIn writes the workspace to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestAnAbsoluteRootIsNamedAsTheAuthorWroteIt(t *testing.T) {
  workspace := t.TempDir()
  contracts := filepath.ToSlash(filepath.Join(workspace, "contracts"))
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"`+contracts+`",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "found no directory at the typescript root '"+contracts+"'. Correct the 'root' property",
  )
  for _, absent := range []string{
    "which resolves to",
    "it resolves against the ttsc project root",
  } {
    if countProblemsContaining(messages, absent) != 0 {
      t.Fatalf(
        "an absolute root landed on itself, so %q describes nothing:\n%s",
        absent,
        strings.Join(messages, "\n"),
      )
    }
  }
}
