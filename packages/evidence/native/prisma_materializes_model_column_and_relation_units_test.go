package evidence

import (
  "testing"
)

/**
 * Verifies a parsed model becomes one model unit owning one unit per column and
 * per relation.
 *
 * The column/relation split is the whole reason this graph asks Prisma's parser
 * rather than reading the schema itself, so materialization must carry the
 * distinction through instead of flattening both into one member kind. The
 * parent links matter just as much: hierarchical acknowledgement is what lets a
 * single citation on a model discharge its members, and it works only if every
 * member records the model's unit ID rather than being inferred later from the
 * dotted target.
 *
 *  1. Materialize a model with a stored column and a relation field.
 *  2. Assert the three units, their symbols, and their targets.
 *  3. Assert both members name the model unit as their parent.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaModelUnits emits exact model,column,relation targets and member ParentIDs while model has no parent.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Authored DTO symbols and literal targets/parent IDs establish graph hierarchy.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Root model and two child kinds remain distinct.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaMaterializesModelColumnAndRelationUnits is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaMaterializesModelColumnAndRelationUnits(t *testing.T) {
  units := prismaModelUnits(prismaModel{
    Name: "Sale",
    Fields: []prismaField{
      {Name: "price", Symbol: "column"},
      {Name: "seller", Symbol: "relation"},
    },
  })
  want := "prisma:Sale=model\nprisma:Sale.price=column\nprisma:Sale.seller=relation"
  if got := prismaUnitIndex(units); got != want {
    t.Fatalf("materialized units:\n%s\nwant:\n%s", got, want)
  }
  for _, unit := range units[1:] {
    if unit.ParentID != "prisma:Sale" {
      t.Fatalf("member %q must belong to the model unit, got parent %q", unit.Target, unit.ParentID)
    }
  }
  if units[0].ParentID != "" {
    t.Fatalf("a model is a root unit, got parent %q", units[0].ParentID)
  }
}
