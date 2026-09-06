package evidence

import (
  "sort"
  "strings"
  "testing"
)

// prismaBridgeUnits parses one schema through the real bridge and renders its
// units as `target=symbol`, so a case can assert the whole classification at
// once instead of reaching through the payload.
func prismaBridgeUnits(t *testing.T, schema string) string {
  t.Helper()
  root := prismaBridgeRoot(t, map[string]string{"prisma/schema.prisma": schema})
  result, err := normalizePrismaSet(root, []string{"prisma/schema.prisma"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 {
    t.Fatalf("expected one parsed set, got problems %v", result.Problems)
  }
  rendered := []string{}
  for _, model := range result.Documents[0].Models {
    for _, unit := range prismaModelUnits(model) {
      rendered = append(rendered, unit.Target+"="+unit.Symbol)
    }
  }
  sort.Strings(rendered)
  return strings.Join(rendered, "\n")
}

/**
 * Verifies an implicit many-to-many relation materializes a relation on each
 * side and no column.
 *
 * This is the shape with no foreign key anywhere: both sides are lists and the
 * join table is Prisma's, not the schema's. A classifier that inferred a column
 * from the field's presence would invent two obligations no citation can ever
 * discharge, on a relation form that is ordinary in real schemas.
 *
 *  1. Declare a list on both sides with no scalar reference.
 *  2. Parse through the real bridge.
 *  3. Assert two models, their ids, and exactly one relation each.
 */
func TestPrismaImplicitManyToManyMaterializesRelationsOnly(t *testing.T) {
  want := strings.Join([]string{
    "prisma:Category.id=column",
    "prisma:Category.posts=relation",
    "prisma:Category=model",
    "prisma:Post.categories=relation",
    "prisma:Post.id=column",
    "prisma:Post=model",
  }, "\n")
  got := prismaBridgeUnits(t, `datasource db {
  provider = "postgresql"
}

model Post {
  id         String     @id @db.Uuid
  categories Category[]
}

model Category {
  id    String @id @db.Uuid
  posts Post[]
}
`)
  if got != want {
    t.Fatalf("implicit many-to-many units:\n%s\nwant:\n%s", got, want)
  }
}

/**
 * Verifies every relation spelling classifies as a relation.
 *
 * Optional, list, and referential-action forms are the same unit kind written
 * three ways, and each reaches the classifier through different payload fields.
 * A rule that keyed on the presence of `relationFromFields` would drop the list
 * side; one that keyed on `isRequired` would drop the optional side. Both
 * failures shrink a relation population silently.
 *
 *  1. Declare an optional relation, a list relation, and one with `onDelete`.
 *  2. Parse through the real bridge.
 *  3. Assert every relation field is a relation and every scalar a column.
 */
func TestPrismaClassifiesEveryRelationSpelling(t *testing.T) {
  want := strings.Join([]string{
    "prisma:Order.id=column",
    "prisma:Order.lines=relation",
    "prisma:Order.owner=relation",
    "prisma:Order.owner_id=column",
    "prisma:Order=model",
    "prisma:User.id=column",
    "prisma:User.orders=relation",
    "prisma:User=model",
    "prisma:line.id=column",
    "prisma:line.order=relation",
    "prisma:line.order_id=column",
    "prisma:line=model",
  }, "\n")
  got := prismaBridgeUnits(t, `datasource db {
  provider = "postgresql"
}

model User {
  id     String  @id @db.Uuid
  orders Order[]
}

model Order {
  id       String  @id @db.Uuid
  owner_id String? @db.Uuid
  owner    User?   @relation(fields: [owner_id], references: [id], onDelete: SetNull)
  lines    line[]
}

model line {
  id       String @id @db.Uuid
  order_id String @db.Uuid
  order    Order  @relation(fields: [order_id], references: [id], onDelete: Cascade)
}
`)
  if got != want {
    t.Fatalf("relation spellings:\n%s\nwant:\n%s", got, want)
  }
}

/**
 * Verifies an enum materializes no unit and does not disturb the models beside
 * it.
 *
 * The campaign draws its boundary at models and their members, and an unpinned
 * boundary is one a later change crosses without noticing. The risk is not that
 * an enum becomes citable — it is that its values are read as members of
 * whichever model was declared before it, which would put obligations on a
 * table that never declared them.
 *
 *  1. Declare an enum between two models and use it as a column type.
 *  2. Parse through the real bridge.
 *  3. Assert only the models and their own members materialize.
 */
func TestPrismaEnumMaterializesNoUnit(t *testing.T) {
  want := strings.Join([]string{
    "prisma:Sale.id=column",
    "prisma:Sale.status=column",
    "prisma:Sale=model",
    "prisma:Seller.id=column",
    "prisma:Seller=model",
  }, "\n")
  got := prismaBridgeUnits(t, `datasource db {
  provider = "postgresql"
}

model Sale {
  id     String     @id @db.Uuid
  status SaleStatus
}

/// The set of sale states.
enum SaleStatus {
  ACTIVE
  CLOSED
}

model Seller {
  id String @id @db.Uuid
}
`)
  if got != want {
    t.Fatalf("units beside an enum:\n%s\nwant:\n%s", got, want)
  }
}

/**
 * Verifies a citation with a target and no reason is malformed on a Prisma
 * host too.
 *
 * The reason is what a reviewer reads, so a citation without one is not a
 * weaker citation — it is an unreviewable one. The grammar is shared with the
 * other artifacts, but a Prisma doc comment reaches it through its own scan and
 * its own tag-boundary flag, which is exactly where a shared rule stops being
 * shared without anyone noticing.
 *
 *  1. Write a target with no reason on a model.
 *  2. Evaluate the declarations.
 *  3. Assert it is malformed rather than silently accepted.
 */
func TestPrismaCitationWithoutAReasonIsMalformed(t *testing.T) {
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {Path: "prisma/schema.prisma", Type: artifactPrisma},
  }
  scan := scanPrismaFile("prisma/schema.prisma", `/// @evidence docs/spec.md#amounts
model Sale {
  price Int
}
`, map[string]prismaLocation{})
  hosts := map[string]*evidenceUnit{}
  for _, unit := range prismaModelUnits(prismaModel{Name: "Sale"}) {
    unit.Path = "prisma/schema.prisma"
    hosts[joinPrismaIdentity(unit.Identity)] = unit
  }
  if problems := prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil); len(problems) != 0 {
    t.Fatalf("validity belongs to the graph, not the scan: %v", problems)
  }
  document, _ := scanProjectMarkdown("docs/spec.md", "## Amounts {#amounts}\n")
  loader := newTypeScriptLoader("", map[string]*artifactInventory{})
  states, problems := materializeClaimStates(
    anchoredGraph("", graphConfig{Claims: []claimSpec{{
      Type:    artifactPrisma,
      Files:   mustGlobSet(t, []string{"prisma/**/*.prisma"}),
      Symbols: symbolSet{"model": true},
      References: []referenceSpec{{
        Type:    artifactMarkdown,
        Files:   mustGlobSet(t, []string{"docs/spec.md"}),
        Symbols: symbolSet{"h2": true},
      }},
    }}}),
    map[string]*artifactInventory{"docs/spec.md": document},
    inventories,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    loader,
  )
  messages := append(problems, evaluateEvidenceGraph(states, loader)...)
  assertProblemContains(t, messages, "Malformed @evidence declaration at prisma/schema.prisma:1")
  // The reasonless citation must not quietly count either, or an author could
  // discharge an obligation with a target and nothing a reviewer can read.
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#amounts'")
}

/**
 * Verifies a citation on a host kind the claim did not select is reported, and
 * does not quietly discharge the obligation.
 *
 * A claim's selector narrows where a citation may sit, and both halves of that
 * matter. Reporting the misplaced host without withholding its coverage would
 * let an author satisfy an obligation from a position the configuration
 * excluded; withholding coverage without reporting would leave them staring at
 * a missing acknowledgement they believe they wrote.
 *
 *  1. Select `model` alone on a Prisma claim.
 *  2. Cite from a column instead.
 *  3. Assert the host is reported and the obligation still stands.
 */
func TestPrismaClaimSelectorRefusesAnUnselectedHost(t *testing.T) {
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {Path: "prisma/schema.prisma", Type: artifactPrisma},
  }
  scan := scanPrismaFile("prisma/schema.prisma", `model Sale {
  /// @evidence docs/spec.md#amounts Cited from a column.
  price Int
}
`, map[string]prismaLocation{})
  hosts := map[string]*evidenceUnit{}
  for _, unit := range prismaModelUnits(prismaModel{
    Name:   "Sale",
    Fields: []prismaField{{Name: "price", Symbol: "column"}},
  }) {
    unit.Path = "prisma/schema.prisma"
    hosts[joinPrismaIdentity(unit.Identity)] = unit
  }
  if problems := prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil); len(problems) != 0 {
    t.Fatalf("host eligibility belongs to the graph, not the scan: %v", problems)
  }
  document, _ := scanProjectMarkdown("docs/spec.md", "## Amounts {#amounts}\n")
  loader := newTypeScriptLoader("", map[string]*artifactInventory{})
  states, problems := materializeClaimStates(
    anchoredGraph("", graphConfig{Claims: []claimSpec{{
      Type:    artifactPrisma,
      Files:   mustGlobSet(t, []string{"prisma/**/*.prisma"}),
      Symbols: symbolSet{"model": true},
      References: []referenceSpec{{
        Type:    artifactMarkdown,
        Files:   mustGlobSet(t, []string{"docs/spec.md"}),
        Symbols: symbolSet{"h2": true},
      }},
    }}}),
    map[string]*artifactInventory{"docs/spec.md": document},
    inventories,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    loader,
  )
  messages := append(problems, evaluateEvidenceGraph(states, loader)...)
  assertProblemContains(t, messages, "Out-of-scope @evidence host at prisma/schema.prisma:2")
  assertProblemContains(t, messages, "host kind 'column' is not selected (model)")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#amounts'")
}

/**
 * Verifies a model declared twice across the set is Prisma's error rather than
 * a silent merge.
 *
 * A model name is unique across a schema folder, which is the whole reason a
 * target never names its file. If the two declarations were merged instead, one
 * model's members would silently join the other's obligations and the citation
 * would point at whichever file the scan reached first.
 *
 *  1. Declare the same model in two files of one set.
 *  2. Parse through the real bridge.
 *  3. Assert the set is rejected with Prisma's own message.
 */
func TestPrismaDuplicateModelAcrossTheSetIsRejected(t *testing.T) {
  sources := []string{"prisma/a.prisma", "prisma/b.prisma"}
  root := prismaBridgeRoot(t, map[string]string{
    sources[0]: `datasource db {
  provider = "postgresql"
}

model Sale {
  id String @id @db.Uuid
}
`,
    sources[1]: `model Sale {
  id String @id @db.Uuid
}
`,
  })
  result, err := normalizePrismaSet(root, sources)
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 0 || len(result.Problems) != 1 {
    t.Fatalf("a duplicate model must reject the set, got %d documents", len(result.Documents))
  }
  if !strings.Contains(result.Problems[0].Message, "Sale") {
    t.Fatalf("the rejection must name the duplicated model: %q", result.Problems[0].Message)
  }
}

/**
 * Verifies an exclusion overlapping an acknowledgement is one conflict, not a
 * silent override.
 *
 * `@evidence` and `@evidenceExclude` on one target are a contradiction the
 * author has to resolve: the schema both uses a section and declares it
 * deliberately unused. Letting the later one win would erase the contradiction
 * and record a reviewed decision nobody made. One diagnostic rather than one
 * per descendant is the same rule the hierarchy already follows.
 *
 *  1. Cite a section from a model and exclude the same section from another.
 *  2. Evaluate the graph.
 *  3. Assert exactly one conflict diagnostic naming the target.
 */
func TestPrismaExclusionOverlappingAnAcknowledgementIsAConflict(t *testing.T) {
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {Path: "prisma/schema.prisma", Type: artifactPrisma},
  }
  scan := scanPrismaFile("prisma/schema.prisma", `/// @evidence docs/spec.md#amounts The sale stores the amount.
model Sale {
  price Int
}

/// @evidenceExclude docs/spec.md#amounts The seller deliberately does not.
model Seller {
  id String
}
`, map[string]prismaLocation{})
  hosts := map[string]*evidenceUnit{}
  for _, model := range []prismaModel{{Name: "Sale"}, {Name: "Seller"}} {
    for _, unit := range prismaModelUnits(model) {
      unit.Path = "prisma/schema.prisma"
      hosts[joinPrismaIdentity(unit.Identity)] = unit
    }
  }
  if problems := prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil); len(problems) != 0 {
    t.Fatalf("the contradiction belongs to the graph, not the scan: %v", problems)
  }
  document, _ := scanProjectMarkdown("docs/spec.md", "## Amounts {#amounts}\n")
  loader := newTypeScriptLoader("", map[string]*artifactInventory{})
  states, problems := materializeClaimStates(
    anchoredGraph("", graphConfig{Claims: []claimSpec{{
      Type:    artifactPrisma,
      Files:   mustGlobSet(t, []string{"prisma/**/*.prisma"}),
      Symbols: symbolSet{"model": true},
      References: []referenceSpec{{
        Type:    artifactMarkdown,
        Files:   mustGlobSet(t, []string{"docs/spec.md"}),
        Symbols: symbolSet{"h2": true},
      }},
    }}}),
    map[string]*artifactInventory{"docs/spec.md": document},
    inventories,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    loader,
  )
  messages := append(problems, evaluateEvidenceGraph(states, loader)...)
  if got := countProblemsContaining(messages, "Conflicting acknowledgements"); got != 1 {
    t.Fatalf("expected exactly one conflict diagnostic, got %d:\n%s", got, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "docs/spec.md#amounts")
}
