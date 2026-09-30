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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraphIn is exercised with the scenario below; the assertions require it names the declared spelling and neither restates nor mis-explains a resolution that never happened.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The base was resolved and then re-spelled project-relative, so an author who declared `C:/contracts` was handed back an ascending path and told to correct a 'root' property their configuration does not contain. Naming the base at all exists to make a population repairable from the diagnostic alone, and a spelling absent from the file being repaired defeats exactly that.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare a TypeScript claim rooted at an absolute directory that is absent. Read the root diagnostic. Assert it names the declared spelling and neither restates nor mis-explains a resolution that never happened.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAnAbsoluteRootIsNamedAsTheAuthorWroteIt is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
