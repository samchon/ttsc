package evidence

import (
  "testing"
)

/**
 * Verifies a lone carriage return ends a line the way Prisma's grammar says.
 *
 * The parser accepts `\r` alone as a line terminator, measured against the
 * installed parser: a doc comment written before a field in such a file
 * documents that field. A scan that split on `\n` alone saw the whole file as
 * one line, so it located only the model and folded every comment into the
 * line above the model.
 *
 *  1. Scan a schema whose lines end in `\r` alone.
 *  2. Assert each name's line.
 *  3. Assert the comment run attaches to the field below it.
 *
 * @evidence contracts/testing.md#behavioral-verification scanPrismaFile returns the model line and both member lines and the comment run attached to the field for a schema terminated by lone carriage returns.
 * @evidence contracts/testing.md#independent-expectations The expected lines and the rendered comment run are literals counted from the authored text; the parser accepting a lone carriage return was measured against the installed parser.
 * @evidence contracts/testing.md#distinguishing-cases A lone carriage return, `\r\n` and `\n` give three line counts that differ for one schema; only a lone carriage return is exercised here, the other two are owned by TestPrismaLocatesAcrossLineEndings.
 * @evidence contracts/testing.md#execution-ownership TestPrismaLocatesAcrossALoneCarriageReturn is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaLocatesAcrossALoneCarriageReturn(t *testing.T) {
  schema := "model Sale {\r  /// A doc.\r  id String @id\r  price Int\r}\r"
  locations := prismaLocationsOf(schema)
  assertPrismaLine(t, locations, "Sale", 1)
  assertPrismaLine(t, locations, "Sale.id", 3)
  assertPrismaLine(t, locations, "Sale.price", 4)
  if got, want := prismaCommentsOf(schema), "doc@2->Sale.id: A doc."; got != want {
    t.Fatalf("the comment must attach to the field below it: got %q, want %q", got, want)
  }
}
