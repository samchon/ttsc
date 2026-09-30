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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies the narrowing still narrows. The original assertions check assert the selected area is owed under its entry address and the other area is not owed at all.
 * @evidence contracts/testing.md#independent-expectations Publishing every address from the entry would be equally silent if the glob had quietly stopped filtering, and that is worse than the defect it replaces: the whole package surface would owe acknowledgement while the configuration still read as adoptable. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Narrow the same package to one of its two areas. Cite neither operation. Assert the selected area is owed under its entry address and the other area is not owed at all. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphNarrowedPackageReferenceStillFiltersMembership is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
