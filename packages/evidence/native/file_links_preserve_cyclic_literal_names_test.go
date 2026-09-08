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
