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
 *
 * @evidence contracts/testing.md#behavioral-verification prismaFieldDigests uses the built Prisma parser; Sale.price must retain its digest for prose edits and change for type, unique and default edits.
 * @evidence contracts/testing.md#independent-expectations Executable column content determines the column digest, while documentation does not. Comparisons use relative invariance and change, not an independently known digest value.
 * @evidence contracts/testing.md#distinguishing-cases The documentation, unique and default variants isolate those edits. The type variant also adapts its default to a string to keep the schema valid, so it does not isolate type change from default representation. No unrelated-column stability or exact hash is asserted.
 * @evidence contracts/testing.md#execution-ownership TestAPrismaDigestFollowsTheDeclaration is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
