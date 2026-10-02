package evidence

import (
  "testing"
)

/**
 * Verifies a doc comment reaches the native side intact.
 *
 * A Prisma claim hosts its citations in `///` comments, and the parser is what
 * proves the comment belongs to the declaration rather than to whatever follows
 * it. If the text arrived collapsed, re-wrapped, or attached to the wrong
 * member, a citation would be read against a declaration its author never wrote
 * it on.
 *
 *  1. Parse a schema whose model and column each carry a multi-line doc comment.
 *  2. Assert each documentation string is the comment's own lines, joined.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizePrismaSet preserves exact model/price documentation and requires the documented field.
 * @evidence contracts/testing.md#independent-expectations Literal comment bytes establish both expected strings independently.
 * @evidence contracts/testing.md#distinguishing-cases Model-level multi-line (two-line) and column-level single-line doc comments must each reach their own declaration; no unattached comment, blank-line detachment or `//` case is run in this body.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeCarriesDocComments is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestPrismaBridgeCarriesDocComments(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema.prisma": `datasource db {
  provider = "postgresql"
}

/// A sale.
/// @evidence docs/spec.md#pricing the sale concept comes from here
model Sale {
  id String @id @db.Uuid

  /// @evidence docs/spec.md#amounts the amount is stored here
  price Int
}
`,
  })
  result, err := normalizePrismaSet(root, []string{"prisma/schema.prisma"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 || len(result.Documents[0].Models) != 1 {
    t.Fatalf("expected one model, got %v / %v", result.Documents, result.Problems)
  }
  model := result.Documents[0].Models[0]
  if model.Documentation != "A sale.\n@evidence docs/spec.md#pricing the sale concept comes from here" {
    t.Fatalf("model documentation: %q", model.Documentation)
  }
  for _, field := range model.Fields {
    if field.Name != "price" {
      continue
    }
    if field.Documentation != "@evidence docs/spec.md#amounts the amount is stored here" {
      t.Fatalf("column documentation: %q", field.Documentation)
    }
    return
  }
  t.Fatal("the documented column must survive the boundary")
}
