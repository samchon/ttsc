package evidence

import (
  "testing"
)

/**
 * Verifies a model and its members each report the line they are written on.
 *
 * Prisma's parser returns no position for anything, so every location this
 * graph reports comes from here. A member attributed to the wrong block would
 * point an author at another model's field, which is worse than pointing at the
 * file: a wrong location reads as authoritative.
 *
 *  1. Scan a schema with two models and members in both.
 *  2. Assert each name's line.
 *  3. Assert the second model's member did not attach to the first model.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification scanPrismaFile locates the checked model/member keys and excludes datasource settings.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal source lines and expected locator positions specify addressable names.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Datasource provider metadata cannot leak into model members.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaLocatesModelsAndMembers is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaLocatesModelsAndMembers(t *testing.T) {
  locations := prismaLocationsOf(`datasource db {
  provider = "postgresql"
}

model Sale {
  id     String @id
  seller Seller @relation(fields: [id], references: [id])
}

model Seller {
  id String @id
}
`)
  assertPrismaLine(t, locations, "Sale", 5)
  assertPrismaLine(t, locations, "Sale.id", 6)
  assertPrismaLine(t, locations, "Sale.seller", 7)
  assertPrismaLine(t, locations, "Seller", 10)
  assertPrismaLine(t, locations, "Seller.id", 11)
  if _, leaked := locations["Sale.provider"]; leaked {
    t.Fatal("a datasource setting must not be read as a model member")
  }
  if _, leaked := locations["db.provider"]; leaked {
    t.Fatal("a datasource owns no addressable member")
  }
}
