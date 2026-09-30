package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a block attribute is not a member.
 *
 * `@@index([a, b])` opens with `@` rather than an identifier, so reading its
 * first token as a name would invent a member no reference can select and no
 * citation can discharge.
 *
 *  1. Scan a model carrying block attributes.
 *  2. Assert the real members are located and the attributes are not.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification scanPrismaSchema locates real members and refuses Sale.@ keys.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal @@ metadata does not declare a field.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Block attributes must not create obligations.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaBlockAttributeIsNotAMember is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaBlockAttributeIsNotAMember(t *testing.T) {
  locations := prismaLocationsOf(`model Sale {
  id    String @id
  price Int

  @@index([price])
  @@map("sales")
}
`)
  assertPrismaLine(t, locations, "Sale.price", 3)
  for key := range locations {
    if strings.HasPrefix(key, "Sale.@") {
      t.Fatalf("%q is a block attribute, not a member", key)
    }
  }
}
