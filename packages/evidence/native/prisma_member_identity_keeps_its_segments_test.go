package evidence

import (
  "testing"
)

/**
 * Verifies a member's identity stays segmented rather than pre-joined.
 *
 * The identity is what an address is rebuilt from, and the locator keys on the
 * same segments. Storing `Sale.price` as one segment would read identically
 * today and quietly lose the boundary the moment anything has to tell a model
 * name from a member name — the same failure the TypeScript side keeps
 * segmented identities to avoid.
 *
 *  1. Materialize a model with one column.
 *  2. Assert the model identity holds one segment and the column two.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaModelUnits preserves one model segment,two member segments and Sale.price locator key.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal segments and independent display key pin hierarchical framing.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Member identities retain boundaries rather than flattening prematurely.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaMemberIdentityKeepsItsSegments is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaMemberIdentityKeepsItsSegments(t *testing.T) {
  units := prismaModelUnits(prismaModel{
    Name:   "Sale",
    Fields: []prismaField{{Name: "price", Symbol: "column"}},
  })
  if len(units[0].Identity) != 1 || units[0].Identity[0] != "Sale" {
    t.Fatalf("model identity: %#v", units[0].Identity)
  }
  if len(units[1].Identity) != 2 ||
    units[1].Identity[0] != "Sale" ||
    units[1].Identity[1] != "price" {
    t.Fatalf("column identity: %#v", units[1].Identity)
  }
  if joinPrismaIdentity(units[1].Identity) != "Sale.price" {
    t.Fatalf("locator key: %q", joinPrismaIdentity(units[1].Identity))
  }
}
