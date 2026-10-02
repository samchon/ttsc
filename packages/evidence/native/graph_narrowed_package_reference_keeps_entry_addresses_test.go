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
 *
 * @evidence contracts/testing.md#behavioral-verification With the nested-accessor package fixture, runIndexRule over a package reference narrowed by `files: lib/functional/health/**` must give no diagnostics for a citation of `{@link api.functional.health.get}`; with an unnarrowed reference and a citation of both `api.functional.health.get` and `api.functional.reviews.erase` it must also give none.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the addressing contract: narrowing a package reference changes the population but not the address a consumer can write, which stays relative to the package entry (the only module a consumer has a specifier for).
 * @evidence contracts/testing.md#distinguishing-cases The same entry-relative address under a narrowed and an unnarrowed reference; an implementation that made each matched module its own traversal entry would collapse the address to `get` and leave the citation unresolved in the narrowed run.
 * @evidence contracts/testing.md#execution-ownership TestGraphNarrowedPackageReferenceKeepsEntryAddresses is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files including a node_modules package, with no consumer install or product host.
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
