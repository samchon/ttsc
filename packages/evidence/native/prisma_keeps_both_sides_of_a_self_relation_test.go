package evidence

import (
  "testing"
)

/**
 * Verifies both sides of a self-relation stay two units on the one model that
 * declares them.
 *
 * Prisma names a relation once and attaches that name to both of its fields, so
 * a materializer that keyed on the relation name would fold `parent` and
 * `children` into a single unit. On a self-relation both sides belong to the
 * same model, so the fold would look locally consistent while silently halving
 * the obligations a relation-selecting reference owes — and no diagnostic would
 * ever mention the side that disappeared.
 *
 *  1. Materialize a model carrying both sides of one named self-relation.
 *  2. Assert both relation fields survive as their own units.
 *  3. Assert each addresses the field it was written as.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaModelUnits preserves parent/children as separate relation units plus id column.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal DTO and expected index specify both field identities.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Two relation sides on one model cannot collapse.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaKeepsBothSidesOfASelfRelation is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaKeepsBothSidesOfASelfRelation(t *testing.T) {
  units := prismaModelUnits(prismaModel{
    Name: "Node",
    Fields: []prismaField{
      {Name: "parent_id", Symbol: "column"},
      {Name: "parent", Symbol: "relation"},
      {Name: "children", Symbol: "relation"},
    },
  })
  want := "prisma:Node=model\nprisma:Node.parent_id=column\nprisma:Node.parent=relation\nprisma:Node.children=relation"
  if got := prismaUnitIndex(units); got != want {
    t.Fatalf("a shared relation name must not merge its two sides:\n%s\nwant:\n%s", got, want)
  }
}
