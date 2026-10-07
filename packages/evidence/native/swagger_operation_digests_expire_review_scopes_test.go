package evidence

import "testing"

// TestSwaggerOperationDigestsExpireReviewScopes verifies normalized operation
// digests reach review fingerprints without making sibling operations expire.
//
// The bridge owns effective OpenAPI meaning; native scope composition must keep
// that supplied digest rather than substituting a whole-document identity.
//
// 1. Materialize two normalized operations and compute their review scopes.
// 2. Change only the first bridge digest and rebuild both scopes.
// 3. Require first-scope expiry and an unchanged sibling fingerprint.
//
// @evidence contracts/testing.md#behavioral-verification swaggerOperationUnit and newScopeIndex preserve supplied per-operation digest differences in fingerprint results and leave the sibling scope unchanged.
// @evidence contracts/testing.md#independent-expectations The review contract requires expiry on cited content edits and stability for independent operations; literal bridge digest variants establish the edit without using scope internals to compute expectations.
// @evidence contracts/testing.md#distinguishing-cases Changed first digest contrasts with identical sibling content and stable method/path identities. Actual effective server/security digest calculation is exercised by the direct TypeScript loader matrix.
// @evidence contracts/testing.md#execution-ownership This selectable native Go unit directly materializes bridge records and invokes the production scope index in-process; it starts no JavaScript bridge, installation, native producer or product host.
func TestSwaggerOperationDigestsExpireReviewScopes(t *testing.T) {
  makeUnits := func(digest string) []*evidenceUnit {
    first, problem := swaggerOperationUnit("api.json", swaggerOperation{Method:"get",Path:"/a",Digest:digest})
    if problem != "" { t.Fatal(problem) }
    second, problem := swaggerOperationUnit("api.json", swaggerOperation{Method:"get",Path:"/b",Digest:"stable"})
    if problem != "" { t.Fatal(problem) }
    return []*evidenceUnit{first,second}
  }
  before, after := makeUnits("effective-one"), makeUnits("effective-two")
  original, edited := newScopeIndex(before), newScopeIndex(after)
  if original.fingerprint(before[0].ID) == edited.fingerprint(after[0].ID) { t.Error("changed operation digest retained its review fingerprint") }
  if original.fingerprint(before[1].ID) != edited.fingerprint(after[1].ID) { t.Error("unrelated operation review expired") }
}
