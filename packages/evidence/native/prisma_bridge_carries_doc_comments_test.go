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
 * @evidence contracts/testing.md#distinguishing-cases Model and member attachment preserve separate documentation.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeCarriesDocComments is one Go E2E entry at packages/evidence/native/prisma_bridge_carries_doc_comments_test.go. It is compiled into the native package beside the actual owner, preserving access to it and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. normalizePrismaSet preserves exact model/price documentation and requires the documented field. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaBridgeCarriesDocComments retains its original function body, local inputs and every assertion after transfer. normalizePrismaSet preserves exact model/price documentation and requires the documented field. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
