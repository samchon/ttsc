package evidence

import "testing"

/**
 * Verifies cyclic paths preserve literal export names and their ambiguity.
 *
 * Legacy inline links join literal dots and qualification, while file links
 * distinguish bracket segments. That distinction must survive namespace hops.
 *
 * 1. Export a class with a literal dotted alias and cyclic namespace aliases.
 * 2. Resolve existing inline spellings through each namespace alias.
 * 3. Introduce a qualified-name collision and require precise file accessors.
 *
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture builds an api/index.ts exporting `Target as "A.B"`, `* as self` and `* as "N.S"` over itself; inline `{@link api.<path>}` citations of `A.B.value`, `self.self.A.B.value` and `N.S.self.A.B.value` (three t.Run rows) must be clean; after adding `namespace A { namespace B { value } }` the citation `api.self.A.B.value` must report `Ambiguous evidence target` and `Missing acknowledgement`, and file links `#self["A.B"].value` and `#self.A.B.value` must then be clean.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the addressing contract: legacy dotted inline links join literal dots and qualification, so the literal export `A.B` and a nested `A.B` collide only in dotted syntax, while bracket accessors in file links tell them apart.
 * @evidence contracts/testing.md#distinguishing-cases Three cyclic-namespace spellings of the literal export (clean), the introduced collision (ambiguous), and the bracket-versus-dotted file links that resolve it (clean); each stage has its own literal expectation.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveCyclicLiteralNames is a Go unit entry in the native test process with three t.Run rows plus direct stages; it drives graphRule.Check through newFileLinkFixture over real temp files and in-memory snapshots, with no consumer install or product host.
 */
func TestFileLinksPreserveCyclicLiteralNames(t *testing.T) {
  module := `class Target { static value = 1; }
export { Target as "A.B" };
export * as self from './index';
export * as "N.S" from './index';`
  options := `{"claims":[{"type":"typescript","files":["review.ts"],"symbol":"type","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`
  for _, target := range []string{"A.B.value", "self.self.A.B.value", "N.S.self.A.B.value"} {
    t.Run(target, func(t *testing.T) {
      source := "import type * as api from './api/index';\n/** @evidence {@link api." + target + "} Reads the value. */\nexport interface Review {}"
      fixture := newFileLinkFixture(t, map[string]string{"api/index.ts": module, "review.ts": source}, options)
      fixture.sources = append(fixture.sources, fixture.source("review.ts", source))
      assertNoProblems(t, fixture.check())
    })
  }
  module += "\nexport namespace A { export namespace B { export const value = 2; } }"
  source := "import type * as api from './api/index';\n/** @evidence {@link api.self.A.B.value} Reads the value. */\nexport interface Review {}"
  fixture := newFileLinkFixture(t, map[string]string{"api/index.ts": module, "review.ts": source}, options)
  fixture.sources = append(fixture.sources, fixture.source("review.ts", source))
  messages := fixture.check()
  assertProblemContains(t, messages, "Ambiguous evidence target")
  assertProblemContains(t, messages, "Missing acknowledgement")
  source = "/**\n@link api/index.ts#self[\"A.B\"].value Reads the literal alias.\n@link api/index.ts#self.A.B.value Reads the qualified value.\n*/\nexport interface Review {}"
  fixture.write("review.ts", source)
  fixture.sources = fixture.sources[:0]
  fixture.sources = append(fixture.sources, fixture.source("review.ts", source))
  assertNoProblems(t, fixture.check())
}
