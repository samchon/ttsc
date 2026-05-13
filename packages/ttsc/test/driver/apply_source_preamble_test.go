package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverApplySourcePreamble verifies generated preambles preserve file
// leaders that must stay at byte zero.
//
// The helper is intentionally tested directly because it is part of the public
// driver contract used by source-preamble plugin output.
//
// 1. Apply a preamble to plain source, BOM-prefixed source, and hashbang source.
// 2. Assert BOM/hashbang ordering remains intact.
// 3. Assert an empty preamble leaves text unchanged.
func TestDriverApplySourcePreamble(t *testing.T) {
  preamble := "/* generated */\n"

  // Scenario table: each entry captures a file leader form that JavaScript
  // tooling treats specially.
  cases := map[string]string{
    "const value = 1;\n":                     preamble + "const value = 1;\n",
    "\ufeffconst value = 1;\n":               "\ufeff" + preamble + "const value = 1;\n",
    "#!/usr/bin/env node\nconsole.log(1);\n": "#!/usr/bin/env node\n" + preamble + "console.log(1);\n",
    "#!/usr/bin/env node":                    "#!/usr/bin/env node\n" + preamble,
  }
  for input, want := range cases {
    got := driver.ApplySourcePreamble(input, preamble)
    if got != want {
      t.Fatalf("preamble mismatch:\nwant: %q\n got: %q", want, got)
    }
  }

  // Empty preambles are a no-op so callers can pass optional plugin output
  // without branching around the driver helper.
  if got := driver.ApplySourcePreamble("unchanged", ""); got != "unchanged" {
    t.Fatalf("empty preamble changed text: %q", got)
  }
}
