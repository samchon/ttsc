package evidence

import (
  "testing"
)

/**
 * Verifies a parsed model carries its own and its members' digests onto their
 * units.
 *
 * The bridge is the only side that understands a Prisma declaration, so the
 * value travels with the identity rather than being rebuilt here. Materializing
 * it onto the unit is what lets `requireReview` compare against the declaration
 * a reviewer read, instead of against the whole schema set's cache key, which
 * every unit shares and which one endpoint's change would expire wholesale.
 *
 * The empty model is the negative twin: a bridge that reports no digest must
 * produce a unit with none, rather than one filled in from something else here.
 *
 *  1. Materialize a model whose parse carried digests.
 *  2. Materialize one whose parse carried none.
 *  3. Assert each unit reports exactly what its declaration carried.
 */
func TestPrismaUnitsCarryTheirParsedDigests(t *testing.T) {
  units := prismaModelUnits(prismaModel{
    Name:   "Sale",
    Digest: "model-digest",
    Fields: []prismaField{
      {Name: "price", Symbol: "column", Digest: "price-digest"},
      {Name: "seller", Symbol: "relation", Digest: "seller-digest"},
    },
  })
  want := map[string]string{
    "prisma:Sale":        "model-digest",
    "prisma:Sale.price":  "price-digest",
    "prisma:Sale.seller": "seller-digest",
  }
  for _, unit := range units {
    if unit.Digest != want[unit.Target] {
      t.Fatalf("%s reported digest %q, want %q", unit.Target, unit.Digest, want[unit.Target])
    }
  }
  bare := prismaModelUnits(prismaModel{
    Name:   "Bare",
    Fields: []prismaField{{Name: "id", Symbol: "column"}},
  })
  for _, unit := range bare {
    if unit.Digest != "" {
      t.Fatalf("%s invented digest %q for a parse that carried none", unit.Target, unit.Digest)
    }
  }
}

/**
 * Verifies an operation carries the digest its normalizer computed.
 *
 * Nothing inside an OpenAPI operation hosts an evidence tag and the operation
 * is the unit, so there is no exclusion to apply and no subtree to compose. The
 * only question is whether the value survives the boundary.
 *
 *  1. Materialize an operation whose normalization carried a digest.
 *  2. Materialize one that carried none.
 *  3. Assert each unit reports exactly what it was given.
 */
func TestSwaggerUnitsCarryTheirNormalizedDigests(t *testing.T) {
  unit, problem := swaggerOperationUnit("api/openapi.json", swaggerOperation{
    Method: "post",
    Path:   "/members",
    Digest: "operation-digest",
  })
  if problem != "" {
    t.Fatalf("expected a unit, got %q", problem)
  }
  if unit.Digest != "operation-digest" {
    t.Fatalf("reported digest %q, want %q", unit.Digest, "operation-digest")
  }
  bare, problem := swaggerOperationUnit("api/openapi.json", swaggerOperation{
    Method: "get",
    Path:   "/members",
  })
  if problem != "" {
    t.Fatalf("expected a unit, got %q", problem)
  }
  if bare.Digest != "" {
    t.Fatalf("invented digest %q for an operation that carried none", bare.Digest)
  }
}

// prismaFieldDigests reads one parsed set's model and field digests through the
// real bridge, keyed by target.
func prismaFieldDigests(t *testing.T, schema string) map[string]string {
  t.Helper()
  root := prismaBridgeRoot(t, map[string]string{"prisma/schema.prisma": schema})
  result, err := normalizePrismaSet(root, []string{"prisma/schema.prisma"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 {
    t.Fatalf("expected one parsed set, got %d (%v)", len(result.Documents), result.Problems)
  }
  digests := map[string]string{}
  for _, model := range result.Documents[0].Models {
    digests[model.Name] = model.Digest
    for _, field := range model.Fields {
      digests[model.Name+"."+field.Name] = field.Digest
    }
  }
  return digests
}

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
 *  2. Parse it again with each single change applied.
 *  3. Assert the documentation edit moves nothing and every other edit moves
 *     the digest of the declaration it touched.
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

/**
 * Verifies an added field is the model's scope rather than the model's own
 * content.
 *
 * A model's digest folds in none of its fields, and the boundary matters in
 * both directions. Folding them in would make one field's edit expire a review
 * of every sibling, which is the mass false-expiry this feature exists to avoid
 * at a smaller radius. Leaving the model unable to notice a new field would let
 * a table grow a column with every review of it still green, and the scope
 * composition on this side is what closes that.
 *
 *  1. Parse a model, then parse it with one field added.
 *  2. Assert the model's own digest and the untouched field's are unchanged.
 *  3. Assert the model's composed scope digest is not.
 */
func TestAnAddedPrismaFieldMovesTheScopeAndNotTheModel(t *testing.T) {
  before := prismaFieldDigests(t, `model Sale {
  id String @id
  price Int
}
`)
  after := prismaFieldDigests(t, `model Sale {
  id String @id
  price Int
  currency String
}
`)
  if before["Sale"] != after["Sale"] {
    t.Fatal("adding a field moved the model's own digest, so a review of the model expires on every sibling's edit too")
  }
  if before["Sale.price"] != after["Sale.price"] {
    t.Fatal("adding a field moved an untouched sibling's digest")
  }
  scope := func(digests map[string]string) string {
    return newScopeIndex([]*evidenceUnit{
      {ID: "prisma:Sale", Target: "prisma:Sale", Symbol: "model", Digest: digests["Sale"]},
      {ID: "prisma:Sale.id", ParentID: "prisma:Sale", Target: "prisma:Sale.id", Symbol: "column", Digest: digests["Sale.id"]},
      {ID: "prisma:Sale.price", ParentID: "prisma:Sale", Target: "prisma:Sale.price", Symbol: "column", Digest: digests["Sale.price"]},
      {ID: "prisma:Sale.currency", ParentID: "prisma:Sale", Target: "prisma:Sale.currency", Symbol: "column", Digest: digests["Sale.currency"]},
    }).fingerprint("prisma:Sale")
  }
  if scope(before) == scope(after) {
    t.Fatal("adding a field left the model's scope digest unmoved, so a review of the model survives a new column")
  }
}
