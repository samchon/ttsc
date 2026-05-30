package linthost

import "testing"

// TestFormatBracketSpacingPadsNamedImports verifies bracketSpacing:true pads
// a single-line named import's braces.
//
//  1. Parse `import {foo, bar} from "m"`.
//  2. Apply format/bracket-spacing with spacing:true.
//  3. Assert it becomes `import { foo, bar } from "m"`.
func TestFormatBracketSpacingPadsNamedImports(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "import {foo, bar} from \"m\";\n",
    `{"spacing":true}`,
    "import { foo, bar } from \"m\";\n",
  )
}
