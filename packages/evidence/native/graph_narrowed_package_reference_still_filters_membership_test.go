package evidence

import "testing"

/**
 * Verifies the narrowing still narrows.
 *
 * Publishing every address from the entry would be equally silent if the glob
 * had quietly stopped filtering, and that is worse than the defect it replaces:
 * the whole package surface would owe acknowledgement while the configuration
 * still read as adoptable.
 *
 *  1. Narrow the same package to one of its two areas.
 *  2. Cite neither operation.
 *  3. Assert the selected area is owed under its entry address and the other
 *     area is not owed at all.
 *
 * @evidence contracts/testing.md#behavioral-verification With the nested-accessor package fixture and a source file citing nothing, runIndexRule over a package reference narrowed by `files: lib/functional/health/**` must report `Missing acknowledgement for 'functional.health.get'` and exactly one `Missing acknowledgement` in total.
 * @evidence contracts/testing.md#independent-expectations The expected single message is authored from the narrowing contract: only the selected area owes an acknowledgement, under its entry address, and the other area (`reviews.erase`) is not owed at all.
 * @evidence contracts/testing.md#distinguishing-cases The complement of the entry-addresses entry: with no citations, a glob that had stopped filtering would also demand `functional.reviews.erase`, making the count two.
 * @evidence contracts/testing.md#execution-ownership TestGraphNarrowedPackageReferenceStillFiltersMembership is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphNarrowedPackageReferenceStillFiltersMembership(t *testing.T) {
  files := nestedAccessorPackage()
  files["src/views/detail.ts"] = "export function detail(): void {}\n"
  messages := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["lib/functional/health/**"],"symbol":"function"}
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'functional.health.get'")
  if countProblemsContaining(messages, "Missing acknowledgement") != 1 {
    t.Fatalf("the glob stopped narrowing the population:\n%v", messages)
  }
}
