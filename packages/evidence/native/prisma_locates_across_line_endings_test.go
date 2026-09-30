package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies CRLF input reports the same lines as LF input.
 *
 * The plugin is developed on Windows and consumed on both, and a schema
 * committed with CRLF is ordinary. A scan that kept the carriage return would
 * still count lines correctly, so the failure would not be a wrong line but a
 * name that never matches — every unit silently falling back to a file-level
 * location on exactly one platform's checkout.
 *
 *  1. Scan one schema twice, with LF and with CRLF.
 *  2. Assert the two answer identically.
 *
 * @evidence contracts/testing.md#behavioral-verification scanPrismaFile returns identical indexes for LF/CRLF source copies.
 * @evidence contracts/testing.md#independent-expectations Only line endings change; equality establishes portability but cannot certify a shared incorrect index.
 * @evidence contracts/testing.md#distinguishing-cases Both newline forms must retain coordinates.
 * @evidence contracts/testing.md#execution-ownership TestPrismaLocatesAcrossLineEndings is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaLocatesAcrossLineEndings(t *testing.T) {
  schema := "model Sale {\n  id String @id\n}\n"
  unix := prismaLocationsOf(schema)
  windows := prismaLocationsOf(strings.ReplaceAll(schema, "\n", "\r\n"))
  if len(unix) != len(windows) {
    t.Fatalf("CRLF located %v, LF located %v", prismaLocationKeys(windows), prismaLocationKeys(unix))
  }
  for key, location := range unix {
    if windows[key] != location {
      t.Fatalf("%q located at %+v under CRLF, %+v under LF", key, windows[key], location)
    }
  }
}
