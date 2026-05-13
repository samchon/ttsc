package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverApplySourcePreamblePreservesBOMShebang verifies combined file
// leaders keep their required order.
//
// Source preambles must be inserted after both the Unicode BOM and a hashbang
// so Node can still recognize executable scripts.
//
// 1. Build source text with a BOM followed by a hashbang.
// 2. Apply a generated source preamble.
// 3. Assert the BOM and hashbang still occupy the physical file leader.
func TestDriverApplySourcePreamblePreservesBOMShebang(t *testing.T) {
  preamble := "/* generated */\n"
  got := driver.ApplySourcePreamble("\ufeff#!/usr/bin/env node\nconsole.log(1);\n", preamble)
  want := "\ufeff#!/usr/bin/env node\n" + preamble + "console.log(1);\n"
  if got != want {
    t.Fatalf("BOM/hashbang preamble mismatch:\nwant: %q\n got: %q", want, got)
  }
}
