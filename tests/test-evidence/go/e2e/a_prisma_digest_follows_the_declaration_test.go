package evidence

import (
  "testing"
)

/**
 * Verifies a Prisma digest answers to the declaration and not to its comment.
 *
 * This is the table the issue leads with. Every row is a change a specification
 * review has to expire on and none of them crossed the boundary before: a
 * field's type, an attribute, and an attribute's argument all reached the Go
 * side as nothing at all, so a digest built from the payload reported fresh for
 * exactly the class of change that matters.
 *
 * The documentation row is the negative twin and the one that decides the
 * feature. A digest covering it moves the moment a review is written into it,
 * so the review is stale before the next build reads it, which is the
 * non-terminating repair loop `requireReview` exists to avoid.
 *
 *  1. Parse a baseline schema through the real bridge.
 *  2. Parse it again with each variant applied.
 *  3. Assert the documentation edit moves nothing and every other edit moves
 *     the digest of the declaration it touched.
 * @evidence contracts/testing.md#behavioral-verification prismaFieldDigests uses the installed Prisma parser; Sale.price must retain its digest for prose edits and change for type, unique and default edits.
 * @evidence contracts/testing.md#independent-expectations Executable column content determines the column digest, while documentation does not. Comparisons use relative invariance and change, not an independently known digest value.
 * @evidence contracts/testing.md#distinguishing-cases The documentation, unique and default variants isolate those edits. The type variant also adapts its default to a string to keep the schema valid, so it does not isolate type change from default representation. No unrelated-column stability or exact hash is asserted.
 * @evidence contracts/testing.md#execution-ownership TestAPrismaDigestFollowsTheDeclaration is the selectable E2E Go entry under tests/test-evidence/go/e2e. Its original local cases execute through the native-package overlay runner and the actual installed parser process; its closure and assertions remain owned by this entry.
 * @evidence contracts/e2e.md#necessary-boundary prismaFieldDigests reaches normalizePrismaSet through the installed @ttsc/evidence Node loader and pinned Prisma parser. Losing column executable metadata or retaining documentation in that cross-language output breaks the change/invariance assertions.
 * @evidence contracts/e2e.md#shared-execution The package build and linked test-evidence dependencies are common prerequisites. This entry keeps its four local variants and creates bridge fixtures through the same helper; it does not rebuild or reinstall per variant, nor replace the parser with a fake.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives each parsed schema an absolute workspace-local root with registered removal. Baseline and each changed schema are distinct inputs; this test does not count process launches or independently prove cache reuse.
 * @evidence contracts/e2e.md#preserved-coverage TestAPrismaDigestFollowsTheDeclaration retains all four original subtests, schema strings and equality/inequality assertions at this E2E address; no assertion was transferred to a fabricated unit result.
 */
func TestAPrismaDigestFollowsTheDeclaration(t *testing.T) {
  base := prismaFieldDigests(t, `model Sale {
  id String @id
  /// The buyer-facing price.
  price Int @unique @default(0)
}
`)
  for _, row := range []struct {
    name    string
    schema  string
    target  string
    expects bool
  }{
    {
      name: "a documentation edit",
      schema: `model Sale {
  id String @id
  /// An entirely different wording of the same thing.
  price Int @unique @default(0)
}
`,
      target:  "Sale.price",
      expects: false,
    },
    {
      name: "a type change",
      schema: `model Sale {
  id String @id
  /// The buyer-facing price.
  price String @unique @default("0")
}
`,
      target:  "Sale.price",
      expects: true,
    },
    {
      name: "a removed attribute",
      schema: `model Sale {
  id String @id
  /// The buyer-facing price.
  price Int @default(0)
}
`,
      target:  "Sale.price",
      expects: true,
    },
    {
      name: "a changed attribute argument",
      schema: `model Sale {
  id String @id
  /// The buyer-facing price.
  price Int @unique @default(1)
}
`,
      target:  "Sale.price",
      expects: true,
    },
  } {
    t.Run(row.name, func(t *testing.T) {
      moved := prismaFieldDigests(t, row.schema)[row.target] != base[row.target]
      if moved != row.expects {
        verb := "moved"
        if row.expects {
          verb = "did not move"
        }
        t.Fatalf("%s %s the digest of %s", row.name, verb, row.target)
      }
    })
  }
}
