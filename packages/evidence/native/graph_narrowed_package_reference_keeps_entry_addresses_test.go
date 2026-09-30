package evidence

import "testing"

/**
 * Verifies a narrowed package reference keeps the address its units are cited
 * by.
 *
 * `files` exists to make a large SDK adoptable, and it defeated itself: every
 * matched module became a traversal entry, so `functional.health.get` collapsed
 * to `get` while an inline link still resolved under the package entry, the only
 * module a consumer has a specifier for. No spelling of the target resolved, so
 * a reference could be adoptable or citable and never both.
 *
 *  1. Install a package that nests its surface two segments below the entry.
 *  2. Cite its operations by the addresses a consumer can write, once with the
 *     reference narrowed to one subtree and once with no narrowing at all.
 *  3. Assert both are silent, so the narrowing changed the population and not
 *     the address.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a narrowed package reference keeps the address its units are cited by. The original assertions check assert both are silent, so the narrowing changed the population and not the address.
 * @evidence contracts/testing.md#independent-expectations `files` exists to make a large SDK adoptable, and it defeated itself: every matched module became a traversal entry, so `functional.health.get` collapsed to `get` while an inline link still resolved under the package entry, the only module a consumer has a specifier for. No spelling of the target resolved, so a reference could be adoptable or citable and never both. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Install a package that nests its surface two segments below the entry. Cite its operations by the addresses a consumer can write, once with the reference narrowed to one subtree and once with no narrowing at all. Assert both are silent, so the narrowing changed the population and not the address. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphNarrowedPackageReferenceKeepsEntryAddresses is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphNarrowedPackageReferenceKeepsEntryAddresses(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, nestedAccessorPackage(), `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["lib/functional/health/**"],"symbol":"function"}
  }]}`))

  wide := nestedAccessorPackage()
  wide["src/views/detail.ts"] = `import type * as api from "@org/api";

/**
 * @evidence {@link api.functional.health.get} Renders this operation's response.
 * @evidence {@link api.functional.reviews.erase} Removes a review.
 */
export function detail(): void {}
`
  assertNoProblems(t, runIndexRule(t, wide, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","symbol":"function"}
  }]}`))
}
