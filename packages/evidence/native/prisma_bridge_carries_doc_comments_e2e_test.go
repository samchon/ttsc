//go:build e2e

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
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeCarriesDocComments is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizePrismaSet (one Node bridge run). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizePrismaSet starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizePrismaSet is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts exactly one parsed model with exact model and price documentation strings and fails if the price field is absent.
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
