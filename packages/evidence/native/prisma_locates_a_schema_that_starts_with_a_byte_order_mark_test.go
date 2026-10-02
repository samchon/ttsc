package evidence

import (
  "testing"
)

/**
 * Verifies a leading byte order mark does not hide the first declaration.
 *
 * The bridge decodes a schema as UTF-8, and that decoder drops a leading byte
 * order mark before the parser reads it, so a schema saved with one is a valid
 * schema. The scan reads the same file, and a mark left on its first line made
 * a first-line `model` opener unrecognisable and a first-line comment trail
 * code, so every unit of that model lost its line and a citation above it was
 * reported as documenting nothing.
 *
 *  1. Scan a schema whose first line is a model opener, behind a mark.
 *  2. Scan a schema whose first line is a documentation comment, behind a mark.
 *  3. Assert the lines and the attachment match the same schema without one.
 *
 * @evidence contracts/testing.md#behavioral-verification scanPrismaFile returns the model and member lines and the comment run attached to the model for text that begins with the three bytes EF BB BF.
 * @evidence contracts/testing.md#independent-expectations The expected lines and the rendered comment run are literals counted from the authored schema text; the parser decoding that drops the mark was measured against the installed parser, not derived from the scan.
 * @evidence contracts/testing.md#distinguishing-cases Two shapes lose different things behind a mark: an opener on line one loses every location, and a comment on line one loses its attachment; each is its own assertion.
 * @evidence contracts/testing.md#execution-ownership TestPrismaLocatesASchemaThatStartsWithAByteOrderMark is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaLocatesASchemaThatStartsWithAByteOrderMark(t *testing.T) {
  opener := prismaLocationsOf("\xef\xbb\xbfmodel Sale {\n  id String @id\n}\n")
  assertPrismaLine(t, opener, "Sale", 1)
  assertPrismaLine(t, opener, "Sale.id", 2)

  documented := "\xef\xbb\xbf/// @evidence docs/spec.md#pricing Written on line one.\nmodel Sale {\n  id String @id\n}\n"
  if got, want := prismaCommentsOf(documented), "doc@1->Sale: @evidence docs/spec.md#pricing Written on line one."; got != want {
    t.Fatalf("a mark must not detach the first-line comment: got %q, want %q", got, want)
  }
}
