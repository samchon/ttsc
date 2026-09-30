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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies cyclic paths preserve literal export names and their ambiguity.
 *
 * @evidence contracts/testing.md#independent-expectations The authored A.B literal and nested A.B declarations collide only in legacy dotted syntax. Bracket accessors independently distinguish both required properties.
 *
 * @evidence contracts/testing.md#distinguishing-cases Export a class with a literal dotted alias and cyclic namespace aliases. Resolve existing inline spellings through each namespace alias. Introduce a qualified-name collision and require precise file accessors.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveCyclicLiteralNames is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
