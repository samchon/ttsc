package evidence

import (
  "strings"
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
  if len(units) != len(want) {
    t.Fatalf("materialized %d units, want %d", len(units), len(want))
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
  for target, digest := range after {
    if digest == "" {
      t.Fatalf("%s carries no digest, so every comparison here passes on emptiness", target)
    }
  }
  if before["Sale"] != after["Sale"] {
    t.Fatal("adding a field moved the model's own digest, so a review of the model expires on every sibling's edit too")
  }
  if before["Sale.price"] != after["Sale.price"] {
    t.Fatal("adding a field moved an untouched sibling's digest")
  }
  if prismaScopeOf(before) == prismaScopeOf(after) {
    t.Fatal("adding a field left the model's scope digest unmoved, so a review of the model survives a new column")
  }
}

// prismaScopeOf composes a model's scope fingerprint from exactly the units one
// parse produced.
//
// Built from the digests in hand rather than from a fixed list, because a fixed
// list makes the two sides differ only in one unit's digest and never in how
// many units there are. That is not the composition production performs, and a
// regression in which a new field materializes no unit at all would leave a
// fixed-list assertion green.
func prismaScopeOf(digests map[string]string) string {
  units := []*evidenceUnit{}
  for target, digest := range digests {
    unit := &evidenceUnit{
      ID:     "prisma:" + target,
      Target: "prisma:" + target,
      Symbol: "model",
      Digest: digest,
    }
    if owner, member, split := strings.Cut(target, "."); split {
      unit.ParentID = "prisma:" + owner
      unit.Symbol = "column"
      _ = member
    }
    units = append(units, unit)
  }
  return newScopeIndex(units).fingerprint("prisma:Sale")
}

/**
 * Verifies a cached schema set serves the digests it stored.
 *
 * The cache copies a parsed set field by field so that only the field slice is
 * reallocated, which means every field the copy does not name is served as its
 * zero value on a hit and correctly on a miss. The model's own digest was one.
 * A resident host therefore asked for one fingerprint on its first cycle and a
 * different one on every cycle after, so a single `ttsc check` and a watch
 * session disagreed permanently on every model citation and no edit could
 * repair it.
 *
 *  1. Store a parsed set carrying model and field digests.
 *  2. Read it back.
 *  3. Assert both digests survived.
 */
func TestACachedPrismaSetServesTheDigestsItStored(t *testing.T) {
  cache := newPrismaCache()
  cache.store("set-key", prismaSetOutcome{Models: []prismaModel{{
    Name:   "Sale",
    Digest: "model-digest",
    Fields: []prismaField{{Name: "price", Symbol: "column", Digest: "price-digest"}},
  }}})
  served, found := cache.lookup("set-key")
  if !found {
    t.Fatal("the entry just stored was not found")
  }
  if len(served.Models) != 1 || len(served.Models[0].Fields) != 1 {
    t.Fatalf("served %d models", len(served.Models))
  }
  if served.Models[0].Digest != "model-digest" {
    t.Fatalf("served model digest %q, want %q", served.Models[0].Digest, "model-digest")
  }
  if served.Models[0].Fields[0].Digest != "price-digest" {
    t.Fatalf("served field digest %q, want %q", served.Models[0].Fields[0].Digest, "price-digest")
  }
}

/**
 * Verifies an operation's digest reaches the schemas it names.
 *
 * The converter preserves `$ref`s rather than inlining them, so an operation is
 * often no more than the name of a contract where its request and response
 * bodies belong. A digest over the operation as written therefore covered the
 * name and not the contract, and changing every property of a DTO expired no
 * review of the endpoint that carries it. That is the failure this feature
 * exists to remove, reproduced on the other bridge.
 *
 * The unchanged sibling is the negative twin. Resolving references must not
 * make one document-wide value out of them, which is the mass false-expiry the
 * whole-source digest would have produced.
 *
 *  1. Normalize a document whose two operations reference one schema each.
 *  2. Change one referenced schema's property type.
 *  3. Assert that operation's digest moved and the other's did not.
 */
func TestASwaggerOperationDigestFollowsTheSchemasItNames(t *testing.T) {
  digests := func(memberType string) map[string]string {
    root := swaggerBridgeRoot(t, `{"openapi":"3.1.0","info":{"title":"A","version":"1"},"paths":{
      "/members":{"post":{"requestBody":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/IMember"}}}},"responses":{"200":{"description":"OK"}}}},
      "/sales":{"post":{"requestBody":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/ISale"}}}},"responses":{"200":{"description":"OK"}}}}
    },"components":{"schemas":{
      "IMember":{"type":"object","properties":{"name":{"type":"`+memberType+`"}},"required":["name"]},
      "ISale":{"type":"object","properties":{"price":{"type":"number"}},"required":["price"]}
    }}}`)
    result, err := normalizeSwaggerSources(root, []string{"swagger.json"})
    if err != nil {
      t.Fatalf("the bridge must run: %v", err)
    }
    if len(result.Documents) != 1 {
      t.Fatalf("expected one normalized document, got %d (%v)", len(result.Documents), result.Problems)
    }
    out := map[string]string{}
    for _, operation := range result.Documents[0].Operations {
      if operation.Digest == "" {
        t.Fatalf("%s %s carries no digest", operation.Method, operation.Path)
      }
      out[strings.ToUpper(operation.Method)+":"+operation.Path] = operation.Digest
    }
    return out
  }
  before := digests("string")
  after := digests("number")
  if before["POST:/members"] == after["POST:/members"] {
    t.Fatalf(
      "changing a referenced schema left the operation's digest unmoved (%s), so a review of the endpoint survives its contract changing",
      before["POST:/members"],
    )
  }
  if before["POST:/sales"] != after["POST:/sales"] {
    t.Fatalf(
      "changing one schema moved an unrelated operation's digest (%s to %s), which is the document-wide expiry this replaces",
      before["POST:/sales"],
      after["POST:/sales"],
    )
  }
}
